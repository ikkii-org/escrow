use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

// ─── Program ID ─────────────────────────────────────────────────────────────────
// Placeholder — replace with devnet-deployed ID via `anchor deploy`
declare_id!("4T3bc2eimNKACT9FxTJaySC5jzqaBLct8Zo4BDjprnN2");

// ─── Constants ──────────────────────────────────────────────────────────────────

pub const MAX_FEE_BPS: u16 = 1000;
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_ESCROW_DURATION_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const TOKEN_ACCOUNT_SPACE: u64 = 165;

// ─── Events ─────────────────────────────────────────────────────────────────────

#[event]
pub struct EscrowCreated {
    pub duel_id: String,
    pub player1: Pubkey,
    pub stake_amount: u64,
    pub token_mint: Pubkey,
    pub is_nft: bool,
    pub expiry: i64,
}

#[event]
pub struct EscrowJoined {
    pub duel_id: String,
    pub player2: Pubkey,
}

#[event]
pub struct EscrowSettled {
    pub duel_id: String,
    pub winner: Pubkey,
    pub payout: u64,
    pub fee: u64,
    pub is_nft: bool,
}

#[event]
pub struct EscrowDisputed {
    pub duel_id: String,
}

#[event]
pub struct EscrowResolved {
    pub duel_id: String,
    pub winner: Pubkey,
    pub payout: u64,
    pub fee: u64,
    pub is_nft: bool,
}

#[event]
pub struct EscrowCancelled {
    pub duel_id: String,
    pub refunded_amount: u64,
}

// ─── Program ────────────────────────────────────────────────────────────────────

#[program]
pub mod ikkiiescrow_v2 {
    use super::*;

    // ── Platform Management ─────────────────────────────────────────────────

    pub fn initialize_platform(ctx: Context<InitializePlatform>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, EscrowError::FeeTooHigh);
        require!(
            ctx.accounts.treasury.key() != Pubkey::default(),
            EscrowError::InvalidTreasury
        );

        let config = &mut ctx.accounts.platform_config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.platform_config;

        msg!(
            "Platform initialized: fee={}bps, treasury={}",
            fee_bps,
            config.treasury
        );
        Ok(())
    }

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

        msg!(
            "Platform updated: fee={}bps, treasury={}",
            config.fee_bps,
            config.treasury
        );
        Ok(())
    }

    // ── Escrow Lifecycle ────────────────────────────────────────────────────

    pub fn create_escrow(
        ctx: Context<CreateEscrowV2>,
        duel_id: [u8; 16],
        stake_amount: u64,
        expiry: i64,
    ) -> Result<()> {
        _create_escrow_internal(ctx, duel_id, stake_amount, expiry, false)
    }

    pub fn create_nft_escrow(
        ctx: Context<CreateEscrowV2>,
        duel_id: [u8; 16],
        stake_amount: u64,
        expiry: i64,
    ) -> Result<()> {
        require!(stake_amount == 1, EscrowError::InvalidStakeAmount);
        require!(ctx.accounts.token_mint.supply == 1, EscrowError::NotAnNft);
        require!(ctx.accounts.token_mint.decimals == 0, EscrowError::NotAnNft);
        _create_escrow_internal(ctx, duel_id, stake_amount, expiry, true)
    }

    pub fn join_escrow(ctx: Context<JoinEscrowV2>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Open,
            EscrowError::InvalidStatus
        );
        require!(
            ctx.accounts.player2.key() != escrow.player1,
            EscrowError::SelfDuel
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < escrow.expiry,
            EscrowError::EscrowExpired
        );

        escrow.player2 = ctx.accounts.player2.key();
        escrow.status = EscrowStatus::Active;

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.player2_token_account.to_account_info(),
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player2.to_account_info(),
            escrow.stake_amount,
            &[],
        )?;

        emit!(EscrowJoined {
            duel_id: hex::encode(escrow.duel_id),
            player2: escrow.player2,
        });

        msg!("Player2 {} joined escrow", escrow.player2);
        Ok(())
    }

    pub fn settle_escrow(ctx: Context<SettleEscrowV2>, winner: Pubkey) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Active,
            EscrowError::InvalidStatus
        );
        require!(
            winner == escrow.player1 || winner == escrow.player2,
            EscrowError::InvalidWinner
        );
        require!(
            ctx.accounts.winner_token_account.owner == winner,
            EscrowError::Unauthorized
        );

        escrow.winner = winner;
        escrow.status = EscrowStatus::Settled;

        let total_pot = escrow
            .stake_amount
            .checked_mul(2)
            .ok_or(EscrowError::Overflow)?;
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

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.winner_token_account.to_account_info(),
            &escrow_info,
            payout,
            signer_seeds,
        )?;

        if fee > 0 {
            _transfer_tokens(
                &ctx.accounts.token_program,
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.treasury_token_account.to_account_info(),
                &escrow_info,
                fee,
                signer_seeds,
            )?;
        }

        emit!(EscrowSettled {
            duel_id: hex::encode(escrow.duel_id),
            winner,
            payout,
            fee,
            is_nft: escrow.is_nft,
        });

        msg!(
            "Escrow settled: winner={}, payout={}, fee={}",
            winner,
            payout,
            fee
        );
        Ok(())
    }

    pub fn dispute_escrow(ctx: Context<DisputeEscrowV2>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::Active,
            EscrowError::InvalidStatus
        );

        escrow.status = EscrowStatus::Disputed;

        emit!(EscrowDisputed {
            duel_id: hex::encode(escrow.duel_id),
        });

        msg!("Escrow disputed");
        Ok(())
    }

    pub fn resolve_dispute(ctx: Context<ResolveDisputeV2>, winner: Pubkey) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatus
        );
        require!(
            winner == escrow.player1 || winner == escrow.player2,
            EscrowError::InvalidWinner
        );
        require!(
            ctx.accounts.winner_token_account.owner == winner,
            EscrowError::Unauthorized
        );

        escrow.winner = winner;
        escrow.status = EscrowStatus::Settled;

        let total_pot = escrow
            .stake_amount
            .checked_mul(2)
            .ok_or(EscrowError::Overflow)?;
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

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.winner_token_account.to_account_info(),
            &escrow_info,
            payout,
            signer_seeds,
        )?;

        if fee > 0 {
            _transfer_tokens(
                &ctx.accounts.token_program,
                &ctx.accounts.vault.to_account_info(),
                &ctx.accounts.treasury_token_account.to_account_info(),
                &escrow_info,
                fee,
                signer_seeds,
            )?;
        }

        emit!(EscrowResolved {
            duel_id: hex::encode(escrow.duel_id),
            winner,
            payout,
            fee,
            is_nft: escrow.is_nft,
        });

        msg!(
            "Dispute resolved: winner={}, payout={}, fee={}",
            winner,
            payout,
            fee
        );
        Ok(())
    }

    pub fn cancel_escrow(ctx: Context<CancelEscrowV2>) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Open,
            EscrowError::InvalidStatus
        );
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

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player1_token_account.to_account_info(),
            &escrow_info,
            refund_amount,
            signer_seeds,
        )?;

        emit!(EscrowCancelled {
            duel_id: hex::encode(escrow.duel_id),
            refunded_amount: refund_amount,
        });

        msg!("Escrow cancelled, player1 refunded {}", refund_amount);
        Ok(())
    }

    pub fn claim_expired(ctx: Context<ClaimExpiredV2>) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Open,
            EscrowError::InvalidStatus
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= escrow.expiry,
            EscrowError::NotExpired
        );

        escrow.status = EscrowStatus::Cancelled;

        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let refund_amount = escrow.stake_amount;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player1_token_account.to_account_info(),
            &escrow_info,
            refund_amount,
            signer_seeds,
        )?;

        emit!(EscrowCancelled {
            duel_id: hex::encode(escrow.duel_id),
            refunded_amount: refund_amount,
        });

        msg!("Expired escrow claimed, player1 refunded {}", refund_amount);
        Ok(())
    }

    pub fn claim_expired_active(ctx: Context<ClaimExpiredActiveV2>) -> Result<()> {
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let escrow = &mut ctx.accounts.escrow;

        require!(
            escrow.status == EscrowStatus::Active,
            EscrowError::InvalidStatus
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= escrow.expiry,
            EscrowError::NotExpired
        );

        escrow.status = EscrowStatus::Cancelled;

        let duel_id = escrow.duel_id;
        let bump = escrow.bump;
        let refund_amount = escrow.stake_amount;
        let seeds: &[&[u8]] = &[b"escrow", duel_id.as_ref(), &[bump]];
        let signer_seeds = &[seeds];

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player1_token_account.to_account_info(),
            &escrow_info,
            refund_amount,
            signer_seeds,
        )?;

        _transfer_tokens(
            &ctx.accounts.token_program,
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.player2_token_account.to_account_info(),
            &escrow_info,
            refund_amount,
            signer_seeds,
        )?;

        emit!(EscrowCancelled {
            duel_id: hex::encode(escrow.duel_id),
            refunded_amount: refund_amount,
        });

        msg!(
            "Expired Active escrow claimed, both players refunded {}",
            refund_amount
        );
        Ok(())
    }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────────

fn _create_escrow_internal(
    ctx: Context<CreateEscrowV2>,
    duel_id: [u8; 16],
    stake_amount: u64,
    expiry: i64,
    is_nft: bool,
) -> Result<()> {
    require!(stake_amount > 0, EscrowError::InvalidStakeAmount);

    let clock = Clock::get()?;
    require!(expiry > clock.unix_timestamp, EscrowError::ExpiryInPast);
    require!(
        expiry <= clock.unix_timestamp + MAX_ESCROW_DURATION_SECONDS,
        EscrowError::ExpiryTooFar
    );

    // Validate token program is either SPL Token or Token-2022
    let token_program_key = ctx.accounts.token_program.key();
    require!(
        token_program_key == anchor_spl::token::ID || token_program_key == TOKEN_2022_PROGRAM_ID,
        EscrowError::InvalidTokenProgram
    );

    let escrow_info = ctx.accounts.escrow.to_account_info();

    // Initialize vault token account
    let (_, vault_bump) = Pubkey::find_program_address(
        &[b"vault", duel_id.as_ref()],
        ctx.program_id,
    );
    let vault_seeds = &[b"vault", duel_id.as_ref(), &[vault_bump]];

    _initialize_token_account(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.token_mint.to_account_info(),
        &escrow_info,
        vault_seeds,
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.player1.to_account_info(),
    )?;

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
    escrow.is_nft = is_nft;
    escrow.token_program_id = token_program_key;

    // Transfer player1's stake into the vault
    _transfer_tokens(
        &ctx.accounts.token_program,
        &ctx.accounts.player1_token_account.to_account_info(),
        &ctx.accounts.vault,
        &ctx.accounts.player1.to_account_info(),
        stake_amount,
        &[],
    )?;

    emit!(EscrowCreated {
        duel_id: hex::encode(duel_id),
        player1: escrow.player1,
        stake_amount,
        token_mint: escrow.token_mint,
        is_nft,
        expiry,
    });

    msg!(
        "Escrow created: duel={}, player1={}, stake={}, expiry={}, is_nft={}",
        hex::encode(duel_id),
        escrow.player1,
        stake_amount,
        expiry,
        is_nft,
    );
    Ok(())
}

fn _transfer_tokens<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // SPL Token / Token-2022 Transfer: discriminator = 3, followed by amount (u64 LE)
    let mut data = vec![3u8];
    data.extend_from_slice(&amount.to_le_bytes());

    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: *token_program.key,
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(*from.key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new(*to.key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(
                *authority.key,
                true,
            ),
        ],
        data,
    };

    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[from.clone(), to.clone(), authority.clone()],
        signer_seeds,
    )
    .map_err(|e| {
        msg!("Transfer failed: {:?}", e);
        anchor_lang::error::Error::from(e)
    })?;

    Ok(())
}

fn _initialize_token_account<'info>(
    token_program: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    owner: &AccountInfo<'info>,
    account_seeds: &[&[u8]],
    system_program: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
) -> Result<()> {
    // Create account via System Program
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(TOKEN_ACCOUNT_SPACE as usize);

    let create_ix = anchor_lang::solana_program::system_instruction::create_account(
        payer.key,
        account.key,
        lamports,
        TOKEN_ACCOUNT_SPACE,
        token_program.key,
    );

    anchor_lang::solana_program::program::invoke_signed(
        &create_ix,
        &[payer.clone(), account.clone(), system_program.clone()],
        &[account_seeds],
    )
    .map_err(|e| {
        msg!("Create account failed: {:?}", e);
        anchor_lang::error::Error::from(e)
    })?;

    // InitializeAccount3: discriminator = 18, followed by owner (32)
    let mut data = vec![18u8];
    data.extend_from_slice(owner.key.as_ref());

    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: *token_program.key,
        accounts: vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(*account.key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*mint.key, false),
        ],
        data,
    };

    anchor_lang::solana_program::program::invoke(
        &ix,
        &[account.clone(), mint.clone()],
    )
    .map_err(|e| {
        msg!("Initialize account failed: {:?}", e);
        anchor_lang::error::Error::from(e)
    })?;

    Ok(())
}

// ─── State ──────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub authority: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowAccountV2 {
    pub duel_id: [u8; 16],
    pub player1: Pubkey,
    pub player2: Pubkey,
    pub stake_amount: u64,
    pub token_mint: Pubkey,
    pub status: EscrowStatus,
    pub winner: Pubkey,
    pub expiry: i64,
    pub bump: u8,
    pub is_nft: bool,
    pub token_program_id: Pubkey,
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
pub struct CreateEscrowV2<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        init,
        payer = player1,
        space = 8 + EscrowAccountV2::INIT_SPACE,
        seeds = [b"escrow", duel_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, EscrowAccountV2>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = player1_token_account.owner == player1.key() @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == token_mint.key() @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    /// Vault PDA — created and initialized manually in the instruction
    /// CHECK: Verified via seeds and initialized via CPI
    #[account(
        mut,
        seeds = [b"vault", duel_id.as_ref()],
        bump,
    )]
    pub vault: AccountInfo<'info>,

    /// Token program: SPL Token or Token-2022
    /// CHECK: Validated in instruction (must be SPL Token or Token-2022)
    pub token_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinEscrowV2<'info> {
    #[account(mut)]
    pub player2: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        constraint = player2_token_account.owner == player2.key() @ EscrowError::Unauthorized,
        constraint = player2_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player2_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SettleEscrowV2<'info> {
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
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        constraint = winner_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token_account.owner == platform_config.treasury @ EscrowError::Unauthorized,
        constraint = treasury_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct DisputeEscrowV2<'info> {
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
    pub escrow: Account<'info, EscrowAccountV2>,
}

#[derive(Accounts)]
pub struct ResolveDisputeV2<'info> {
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
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        constraint = winner_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token_account.owner == platform_config.treasury @ EscrowError::Unauthorized,
        constraint = treasury_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelEscrowV2<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        constraint = player1_token_account.owner == player1.key() @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimExpiredV2<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        constraint = player1_token_account.owner == escrow.player1 @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimExpiredActiveV2<'info> {
    #[account(mut)]
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.duel_id.as_ref()],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, EscrowAccountV2>,

    #[account(
        mut,
        seeds = [b"vault", escrow.duel_id.as_ref()],
        bump,
    )]
    /// CHECK: Verified via seeds
    pub vault: AccountInfo<'info>,

    #[account(
        mut,
        constraint = player1_token_account.owner == escrow.player1 @ EscrowError::Unauthorized,
        constraint = player1_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player1_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = player2_token_account.owner == escrow.player2 @ EscrowError::Unauthorized,
        constraint = player2_token_account.mint == escrow.token_mint @ EscrowError::MintMismatch,
    )]
    pub player2_token_account: Account<'info, TokenAccount>,

    /// CHECK: Must match escrow.token_program_id
    #[account(
        constraint = token_program.key() == escrow.token_program_id @ EscrowError::InvalidTokenProgram
    )]
    pub token_program: AccountInfo<'info>,
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

    #[msg("Expiry timestamp is too far in the future (max 30 days)")]
    ExpiryTooFar,

    #[msg("Invalid treasury address")]
    InvalidTreasury,

    #[msg("Token program must be SPL Token or Token-2022")]
    InvalidTokenProgram,

    #[msg("Mint is not a valid NFT (supply must be 1, decimals must be 0)")]
    NotAnNft,
}
