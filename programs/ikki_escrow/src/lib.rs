use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7rP4rHKBqnYGB2UgpeRtd9f3FZ1PHwfc4iPVhWRv9UP4");

// ─── Constants ──────────────────────────────────────────────────────────────────

/// Maximum platform fee: 10% (1000 basis points)
pub const MAX_FEE_BPS: u16 = 1000;

/// Basis-point denominator
pub const BPS_DENOMINATOR: u64 = 10_000;

// ─── Program ────────────────────────────────────────────────────────────────────

#[program]
pub mod ikki_escrow {
    use super::*;

    // ── Platform Management ─────────────────────────────────────────────────

    /// One-time initialisation: create the singleton PlatformConfig.
    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);

        let config = &mut ctx.accounts.platform_config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.platform_config;

        msg!("Platform initialized: fee={}bps, treasury={}", fee_bps, config.treasury);
        Ok(())
    }

    /// Update fee or treasury (authority only).
    pub fn update_platform(
        ctx: Context<UpdatePlatform>,
        new_fee_bps: Option<u16>,
        new_treasury: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.platform_config;

        if let Some(fee) = new_fee_bps {
            require!(fee <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
            config.fee_bps = fee;
        }
        if let Some(treasury) = new_treasury {
            config.treasury = treasury;
        }

        msg!("Platform updated: fee={}bps, treasury={}", config.fee_bps, config.treasury);
        Ok(())
    }

    // ── Escrow Lifecycle ────────────────────────────────────────────────────

    /// Player 1 creates an escrow and deposits their stake into the vault.
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        duel_id: [u8; 16],
        stake_amount: u64,
        expiry: i64,
    ) -> Result<()> {
        require!(stake_amount > 0, EscrowError::InvalidStakeAmount);

        let clock = Clock::get()?;
        require!(expiry > clock.unix_timestamp, EscrowError::ExpiryInPast);

        let escrow = &mut ctx.accounts.escrow;
        escrow.duel_id = duel_id;
        escrow.player1 = ctx.accounts.player1.key();
        escrow.player2 = Pubkey::default();
        escrow.stake_amount = stake_amount;
        escrow.token_mint = ctx.accounts.token_mint.key();
        escrow.status = EscrowStatus::Open;
        escrow.winner = Pubkey::default();
        escrow.expiry = expiry;
        escrow.bump = ctx.bumps.escrow;

        // Transfer player1's stake into the vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player1_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player1.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        msg!(
            "Escrow created: duel={}, player1={}, stake={}, expiry={}",
            hex::encode(duel_id),
            escrow.player1,
            stake_amount,
            expiry,
        );
        Ok(())
    }

    /// Player 2 joins the escrow and deposits their matching stake.
    pub fn join_escrow(ctx: Context<JoinEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Open, EscrowError::InvalidStatus);
        require!(
            ctx.accounts.player2.key() != escrow.player1,
            EscrowError::SelfDuel
        );

        let clock = Clock::get()?;
        require!(clock.unix_timestamp < escrow.expiry, EscrowError::EscrowExpired);

        escrow.player2 = ctx.accounts.player2.key();
        escrow.status = EscrowStatus::Active;

        // Transfer player2's stake into the vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player2_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.player2.to_account_info(),
                },
            ),
            escrow.stake_amount,
        )?;

        msg!("Player2 {} joined escrow", escrow.player2);
        Ok(())
    }

    /// Authority settles an active escrow: winner receives pot minus fee,
    /// treasury receives the fee.
    pub fn settle_escrow(ctx: Context<SettleEscrow>, winner: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Active, EscrowError::InvalidStatus);
        require!(
            winner == escrow.player1 || winner == escrow.player2,
            EscrowError::InvalidWinner
        );

        escrow.winner = winner;
        escrow.status = EscrowStatus::Settled;

        let total_pot = escrow.stake_amount.checked_mul(2).ok_or(EscrowError::Overflow)?;
        let fee = total_pot
            .checked_mul(ctx.accounts.platform_config.fee_bps as u64)
            .ok_or(EscrowError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(EscrowError::Overflow)?;
        let payout = total_pot.checked_sub(fee).ok_or(EscrowError::Overflow)?;

        // PDA signer seeds for the vault authority
        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Pay winner
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.winner_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
        )?;

        // Pay treasury fee (if > 0)
        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_token_account.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;
        }

        msg!("Escrow settled: winner={}, payout={}, fee={}", winner, payout, fee);
        Ok(())
    }

    /// Authority marks an active escrow as disputed.
    pub fn dispute_escrow(ctx: Context<DisputeEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == EscrowStatus::Active, EscrowError::InvalidStatus);

        escrow.status = EscrowStatus::Disputed;
        msg!("Escrow disputed");
        Ok(())
    }

    /// Authority resolves a disputed escrow: same payout logic as settle.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, winner: Pubkey) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Disputed, EscrowError::InvalidStatus);
        require!(
            winner == escrow.player1 || winner == escrow.player2,
            EscrowError::InvalidWinner
        );

        escrow.winner = winner;
        escrow.status = EscrowStatus::Settled;

        let total_pot = escrow.stake_amount.checked_mul(2).ok_or(EscrowError::Overflow)?;
        let fee = total_pot
            .checked_mul(ctx.accounts.platform_config.fee_bps as u64)
            .ok_or(EscrowError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(EscrowError::Overflow)?;
        let payout = total_pot.checked_sub(fee).ok_or(EscrowError::Overflow)?;

        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Pay winner
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.winner_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
        )?;

        // Pay treasury fee
        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_token_account.to_account_info(),
                        authority: ctx.accounts.escrow.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;
        }

        msg!("Dispute resolved: winner={}, payout={}, fee={}", winner, payout, fee);
        Ok(())
    }

    /// Player 1 cancels an open escrow (before anyone joins).
    pub fn cancel_escrow(ctx: Context<CancelEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Open, EscrowError::InvalidStatus);
        require!(
            ctx.accounts.player1.key() == escrow.player1,
            EscrowError::Unauthorized
        );

        escrow.status = EscrowStatus::Cancelled;

        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let refund_amount = escrow.stake_amount;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Refund player1
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player1_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;

        msg!("Escrow cancelled, player1 refunded {}", refund_amount);
        Ok(())
    }

    /// Permissionless crank: anyone can claim an expired Open escrow to refund player1.
    pub fn claim_expired(ctx: Context<ClaimExpired>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Open, EscrowError::InvalidStatus);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= escrow.expiry, EscrowError::NotExpired);

        escrow.status = EscrowStatus::Cancelled;

        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let refund_amount = escrow.stake_amount;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        // Refund player1
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player1_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;

        msg!("Expired escrow claimed, player1 refunded {}", refund_amount);
        Ok(())
    }
}

// ─── State ──────────────────────────────────────────────────────────────────────

/// Singleton platform configuration. Seeds: ["platform_config"].
#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    /// Admin / backend authority that can settle duels
    pub authority: Pubkey,
    /// Platform fee in basis points (e.g. 250 = 2.5%)
    pub fee_bps: u16,
    /// Treasury wallet that receives platform fees
    pub treasury: Pubkey,
    /// PDA bump
    pub bump: u8,
}

/// Per-duel escrow account. Seeds: ["escrow", duel_id].
#[account]
#[derive(InitSpace)]
pub struct EscrowAccount {
    /// Matches the off-chain duel UUID (16 bytes)
    pub duel_id: [u8; 16],
    /// Player 1 (creator) public key
    pub player1: Pubkey,
    /// Player 2 (joiner) public key — default (all zeros) when Open
    pub player2: Pubkey,
    /// Stake per player in token smallest units
    pub stake_amount: u64,
    /// SPL token mint address (e.g. SKR token)
    pub token_mint: Pubkey,
    /// Current escrow lifecycle status
    pub status: EscrowStatus,
    /// Winner public key — default (all zeros) until settled
    pub winner: Pubkey,
    /// Unix timestamp after which an Open escrow can be reclaimed
    pub expiry: i64,
    /// PDA bump seed
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Open,
    Active,
    Disputed,
    Settled,
    Cancelled,
}

// ─── Account Contexts ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [b"platform_config"],
        bump,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    /// CHECK: Treasury wallet — validated off-chain. Just stored as pubkey.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePlatform<'info> {
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        has_one = authority @ EscrowError::Unauthorized,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(duel_id: [u8; 16], stake_amount: u64, expiry: i64)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        init,
        payer = player1,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [b"escrow", duel_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// The SPL token mint for the duel (e.g. SKR)
    pub token_mint: Account<'info, Mint>,

    /// Player 1's token account (source of stake)
    #[account(
        mut,
        constraint = player1_token_account.owner == player1.key() @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == token_mint.key() @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    /// PDA-owned vault to hold escrowed tokens
    #[account(
        init,
        payer = player1,
        token::mint = token_mint,
        token::authority = escrow,
        seeds = [b"vault", duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct JoinEscrow<'info> {
    #[account(mut)]
    pub player2: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// Player 2's token account (source of stake)
    #[account(
        mut,
        constraint = player2_token_account.owner == player2.key() @ EscrowError::Unauthorized,
        constraint = player2_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player2_token_account: Account<'info, TokenAccount>,

    /// The vault holding escrowed tokens
    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettleEscrow<'info> {
    /// Platform authority (backend signer)
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        has_one = authority @ EscrowError::Unauthorized,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    /// Vault holding the escrowed tokens
    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Winner's token account to receive payout
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// Treasury token account to receive platform fee
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DisputeEscrow<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        has_one = authority @ EscrowError::Unauthorized,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump = platform_config.bump,
        has_one = authority @ EscrowError::Unauthorized,
    )]
    pub platform_config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Winner's token account
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// Treasury token account for fee
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelEscrow<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Player 1's token account (receives refund)
    #[account(
        mut,
        constraint = player1_token_account.owner == player1.key() @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimExpired<'info> {
    /// Anyone can crank this — no signer constraint on identity
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Player 1's token account (receives refund)
    #[account(
        mut,
        constraint = player1_token_account.owner == escrow.player1 @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── Errors ─────────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Only the platform authority can perform this action")]
    Unauthorized,

    #[msg("Invalid escrow status for this operation")]
    InvalidStatus,

    #[msg("A player cannot duel themselves")]
    SelfDuel,

    #[msg("This escrow has expired")]
    EscrowExpired,

    #[msg("This escrow has not expired yet")]
    NotExpired,

    #[msg("Stake amount must be greater than zero")]
    InvalidStakeAmount,

    #[msg("Winner must be one of the duel participants")]
    InvalidWinner,

    #[msg("Platform fee exceeds maximum allowed")]
    FeeTooHigh,

    #[msg("Token mint does not match the escrow")]
    MintMismatch,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Expiry timestamp must be in the future")]
    ExpiryInPast,
}
