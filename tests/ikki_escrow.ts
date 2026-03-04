import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createMint,
    createAccount as createTokenAccount,
    mintTo,
    getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import type { IkkiEscrow } from "../target/types/ikki_escrow";
import {
    findPlatformConfigPDA,
    findEscrowPDA,
    findVaultPDA,
} from "../sdk/src/sdk";

describe("ikki_escrow", () => {
    const provider = AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.IkkiEscrow as Program<IkkiEscrow>;

    // ── Key actors ──────────────────────────────────────────────────────────
    const authority = Keypair.generate();
    const player1 = Keypair.generate();
    const player2 = Keypair.generate();
    const treasury = Keypair.generate();

    let tokenMint: PublicKey;
    let player1Token: PublicKey;
    let player2Token: PublicKey;
    let treasuryToken: PublicKey;

    const FEE_BPS = 250; // 2.5%
    const STAKE_AMOUNT = 1_000_000_000; // 1 token (assuming 9 decimals)

    // Reuse across lifecycle tests
    const duelId = Buffer.alloc(16);
    duelId.writeUInt32BE(1, 12);

    // A separate duel ID for cancel tests
    const cancelDuelId = Buffer.alloc(16);
    cancelDuelId.writeUInt32BE(2, 12);

    // Separate duel ID for dispute tests
    const disputeDuelId = Buffer.alloc(16);
    disputeDuelId.writeUInt32BE(3, 12);

    // Separate duel ID for expiry tests
    const expiryDuelId = Buffer.alloc(16);
    expiryDuelId.writeUInt32BE(4, 12);

    // Separate duel ID for error case tests
    const errorDuelId = Buffer.alloc(16);
    errorDuelId.writeUInt32BE(5, 12);

    // ── Setup: airdrop SOL and create SPL token ─────────────────────────────
    before(async () => {
        // Airdrop SOL to all actors
        const airdropAmount = 10 * LAMPORTS_PER_SOL;
        for (const kp of [authority, player1, player2, treasury]) {
            const sig = await provider.connection.requestAirdrop(
                kp.publicKey,
                airdropAmount,
            );
            await provider.connection.confirmTransaction(sig, "confirmed");
        }

        // Create a mock SPL token mint (simulating SKR token)
        tokenMint = await createMint(
            provider.connection,
            authority,
            authority.publicKey,
            null,
            9, // 9 decimals
        );

        // Create token accounts for all actors
        player1Token = await createTokenAccount(
            provider.connection,
            player1,
            tokenMint,
            player1.publicKey,
        );
        player2Token = await createTokenAccount(
            provider.connection,
            player2,
            tokenMint,
            player2.publicKey,
        );
        treasuryToken = await createTokenAccount(
            provider.connection,
            treasury,
            tokenMint,
            treasury.publicKey,
        );

        // Mint tokens to players
        const mintAmount = 100_000_000_000; // 100 tokens
        await mintTo(
            provider.connection,
            authority,
            tokenMint,
            player1Token,
            authority,
            mintAmount,
        );
        await mintTo(
            provider.connection,
            authority,
            tokenMint,
            player2Token,
            authority,
            mintAmount,
        );
    });

    // ── 1. Initialize Platform ──────────────────────────────────────────────
    it("Initializes the platform config", async () => {
        const [platformConfigPDA] = findPlatformConfigPDA(program.programId);

        await program.methods
            .initializePlatform(FEE_BPS)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                treasury: treasury.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();

        const config = await program.account.platformConfig.fetch(platformConfigPDA);
        expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
        expect(config.feeBps).to.equal(FEE_BPS);
        expect(config.treasury.toBase58()).to.equal(treasury.publicKey.toBase58());
    });

    // ── 2. Create Escrow ────────────────────────────────────────────────────
    it("Creates an escrow and deposits player1 stake", async () => {
        const [escrowPDA] = findEscrowPDA(duelId, program.programId);
        const [vaultPDA] = findVaultPDA(duelId, program.programId);

        const expiryTs = new BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour

        await program.methods
            .createEscrow(
                Array.from(duelId) as any,
                new BN(STAKE_AMOUNT),
                expiryTs,
            )
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount: player1Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([player1])
            .rpc();

        const escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(escrow.player1.toBase58()).to.equal(player1.publicKey.toBase58());
        expect(escrow.stakeAmount.toNumber()).to.equal(STAKE_AMOUNT);
        expect(JSON.stringify(escrow.status)).to.include("open");

        // Vault should hold the stake
        const vaultAccount = await getAccount(provider.connection, vaultPDA);
        expect(Number(vaultAccount.amount)).to.equal(STAKE_AMOUNT);
    });

    // ── 3. Join Escrow ──────────────────────────────────────────────────────
    it("Player2 joins and deposits matching stake", async () => {
        const [escrowPDA] = findEscrowPDA(duelId, program.programId);
        const [vaultPDA] = findVaultPDA(duelId, program.programId);

        await program.methods
            .joinEscrow()
            .accountsStrict({
                player2: player2.publicKey,
                escrow: escrowPDA,
                player2TokenAccount: player2Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        const escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(escrow.player2.toBase58()).to.equal(player2.publicKey.toBase58());
        expect(JSON.stringify(escrow.status)).to.include("active");

        // Vault should now hold 2x stake
        const vaultAccount = await getAccount(provider.connection, vaultPDA);
        expect(Number(vaultAccount.amount)).to.equal(STAKE_AMOUNT * 2);
    });

    // ── 4. Settle Escrow ────────────────────────────────────────────────────
    it("Authority settles: winner gets pot minus fee, treasury gets fee", async () => {
        const [platformConfigPDA] = findPlatformConfigPDA(program.programId);
        const [escrowPDA] = findEscrowPDA(duelId, program.programId);
        const [vaultPDA] = findVaultPDA(duelId, program.programId);

        const player1BalanceBefore = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );

        await program.methods
            .settleEscrow(player1.publicKey)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
                vault: vaultPDA,
                winnerTokenAccount: player1Token,
                treasuryTokenAccount: treasuryToken,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        const escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(escrow.winner.toBase58()).to.equal(player1.publicKey.toBase58());
        expect(JSON.stringify(escrow.status)).to.include("settled");

        // Verify payout amounts
        const totalPot = STAKE_AMOUNT * 2;
        const expectedFee = Math.floor((totalPot * FEE_BPS) / 10_000);
        const expectedPayout = totalPot - expectedFee;

        const player1BalanceAfter = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );
        expect(player1BalanceAfter - player1BalanceBefore).to.equal(expectedPayout);

        const treasuryBalance = Number(
            (await getAccount(provider.connection, treasuryToken)).amount,
        );
        expect(treasuryBalance).to.equal(expectedFee);
    });

    // ── 5. Dispute + Resolve ────────────────────────────────────────────────
    it("Creates, joins, disputes, and resolves an escrow", async () => {
        const [platformConfigPDA] = findPlatformConfigPDA(program.programId);
        const [escrowPDA] = findEscrowPDA(disputeDuelId, program.programId);
        const [vaultPDA] = findVaultPDA(disputeDuelId, program.programId);

        const expiryTs = new BN(Math.floor(Date.now() / 1000) + 3600);

        // Create
        await program.methods
            .createEscrow(
                Array.from(disputeDuelId) as any,
                new BN(STAKE_AMOUNT),
                expiryTs,
            )
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount: player1Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([player1])
            .rpc();

        // Join
        await program.methods
            .joinEscrow()
            .accountsStrict({
                player2: player2.publicKey,
                escrow: escrowPDA,
                player2TokenAccount: player2Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        // Dispute
        await program.methods
            .disputeEscrow()
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
            })
            .signers([authority])
            .rpc();

        let escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(JSON.stringify(escrow.status)).to.include("disputed");

        // Resolve — player2 wins this time
        await program.methods
            .resolveDispute(player2.publicKey)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
                vault: vaultPDA,
                winnerTokenAccount: player2Token,
                treasuryTokenAccount: treasuryToken,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(escrow.winner.toBase58()).to.equal(player2.publicKey.toBase58());
        expect(JSON.stringify(escrow.status)).to.include("settled");
    });

    // ── 6. Cancel Escrow ────────────────────────────────────────────────────
    it("Player1 cancels an Open escrow and gets refunded", async () => {
        const [escrowPDA] = findEscrowPDA(cancelDuelId, program.programId);
        const [vaultPDA] = findVaultPDA(cancelDuelId, program.programId);

        const expiryTs = new BN(Math.floor(Date.now() / 1000) + 3600);

        const balanceBefore = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );

        // Create
        await program.methods
            .createEscrow(
                Array.from(cancelDuelId) as any,
                new BN(STAKE_AMOUNT),
                expiryTs,
            )
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount: player1Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([player1])
            .rpc();

        // Cancel
        await program.methods
            .cancelEscrow()
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                vault: vaultPDA,
                player1TokenAccount: player1Token,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        const escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(JSON.stringify(escrow.status)).to.include("cancelled");

        // Balance should be restored
        const balanceAfter = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );
        expect(balanceAfter).to.equal(balanceBefore);
    });

    // ── 7. Claim Expired ───────────────────────────────────────────────────
    it("Anyone can claim an expired escrow to refund player1", async () => {
        const [escrowPDA] = findEscrowPDA(expiryDuelId, program.programId);
        const [vaultPDA] = findVaultPDA(expiryDuelId, program.programId);

        // Create with very short expiry (1 second in the past won't work on-chain,
        // so we set it 2 seconds in the future and wait)
        const expiryTs = new BN(Math.floor(Date.now() / 1000) + 2);

        const balanceBefore = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );

        await program.methods
            .createEscrow(
                Array.from(expiryDuelId) as any,
                new BN(STAKE_AMOUNT),
                expiryTs,
            )
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount: player1Token,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([player1])
            .rpc();

        // Wait for expiry
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Any cranker can claim
        const cranker = Keypair.generate();
        const crankerAirdrop = await provider.connection.requestAirdrop(
            cranker.publicKey,
            LAMPORTS_PER_SOL,
        );
        await provider.connection.confirmTransaction(crankerAirdrop, "confirmed");

        await program.methods
            .claimExpired()
            .accountsStrict({
                cranker: cranker.publicKey,
                escrow: escrowPDA,
                vault: vaultPDA,
                player1TokenAccount: player1Token,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([cranker])
            .rpc();

        const escrow = await program.account.escrowAccount.fetch(escrowPDA);
        expect(JSON.stringify(escrow.status)).to.include("cancelled");

        const balanceAfter = Number(
            (await getAccount(provider.connection, player1Token)).amount,
        );
        expect(balanceAfter).to.equal(balanceBefore);
    });

    // ── 8. Error Cases ──────────────────────────────────────────────────────
    describe("Error cases", () => {
        it("Rejects self-duel (player1 == player2)", async () => {
            const [escrowPDA] = findEscrowPDA(errorDuelId, program.programId);
            const [vaultPDA] = findVaultPDA(errorDuelId, program.programId);

            const expiryTs = new BN(Math.floor(Date.now() / 1000) + 3600);

            // Create escrow as player1
            await program.methods
                .createEscrow(
                    Array.from(errorDuelId) as any,
                    new BN(STAKE_AMOUNT),
                    expiryTs,
                )
                .accountsStrict({
                    player1: player1.publicKey,
                    escrow: escrowPDA,
                    tokenMint,
                    player1TokenAccount: player1Token,
                    vault: vaultPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .signers([player1])
                .rpc();

            // Try joining as player1 (should fail)
            try {
                await program.methods
                    .joinEscrow()
                    .accountsStrict({
                        player2: player1.publicKey,
                        escrow: escrowPDA,
                        player2TokenAccount: player1Token,
                        vault: vaultPDA,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([player1])
                    .rpc();
                expect.fail("Should have thrown SelfDuel error");
            } catch (err: any) {
                expect(err.toString()).to.include("SelfDuel");
            }
        });

        it("Rejects settle by non-authority", async () => {
            // Use the errorDuelId escrow — need to join first
            const [platformConfigPDA] = findPlatformConfigPDA(program.programId);
            const [escrowPDA] = findEscrowPDA(errorDuelId, program.programId);
            const [vaultPDA] = findVaultPDA(errorDuelId, program.programId);

            // Join as player2
            await program.methods
                .joinEscrow()
                .accountsStrict({
                    player2: player2.publicKey,
                    escrow: escrowPDA,
                    player2TokenAccount: player2Token,
                    vault: vaultPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([player2])
                .rpc();

            // Try to settle as player1 (not authority)
            try {
                await program.methods
                    .settleEscrow(player1.publicKey)
                    .accountsStrict({
                        authority: player1.publicKey,
                        platformConfig: platformConfigPDA,
                        escrow: escrowPDA,
                        vault: vaultPDA,
                        winnerTokenAccount: player1Token,
                        treasuryTokenAccount: treasuryToken,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([player1])
                    .rpc();
                expect.fail("Should have thrown Unauthorized error");
            } catch (err: any) {
                expect(err.toString()).to.include("Unauthorized");
            }
        });

        it("Rejects invalid winner on settle", async () => {
            const [platformConfigPDA] = findPlatformConfigPDA(program.programId);
            const [escrowPDA] = findEscrowPDA(errorDuelId, program.programId);
            const [vaultPDA] = findVaultPDA(errorDuelId, program.programId);

            const randomKey = Keypair.generate().publicKey;
            const randomToken = await createTokenAccount(
                provider.connection,
                authority,
                tokenMint,
                randomKey,
            );

            try {
                await program.methods
                    .settleEscrow(randomKey)
                    .accountsStrict({
                        authority: authority.publicKey,
                        platformConfig: platformConfigPDA,
                        escrow: escrowPDA,
                        vault: vaultPDA,
                        winnerTokenAccount: randomToken,
                        treasuryTokenAccount: treasuryToken,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([authority])
                    .rpc();
                expect.fail("Should have thrown InvalidWinner error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidWinner");
            }
        });

        it("Rejects settling an already-settled escrow", async () => {
            // duelId was already settled in test 4
            const [platformConfigPDA] = findPlatformConfigPDA(program.programId);
            const [escrowPDA] = findEscrowPDA(duelId, program.programId);
            const [vaultPDA] = findVaultPDA(duelId, program.programId);

            try {
                await program.methods
                    .settleEscrow(player1.publicKey)
                    .accountsStrict({
                        authority: authority.publicKey,
                        platformConfig: platformConfigPDA,
                        escrow: escrowPDA,
                        vault: vaultPDA,
                        winnerTokenAccount: player1Token,
                        treasuryTokenAccount: treasuryToken,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([authority])
                    .rpc();
                expect.fail("Should have thrown InvalidStatus error");
            } catch (err: any) {
                expect(err.toString()).to.include("InvalidStatus");
            }
        });

        it("Rejects fee > 10%", async () => {
            // Can't re-init, but try to update with too-high fee
            const [platformConfigPDA] = findPlatformConfigPDA(program.programId);

            try {
                await program.methods
                    .updatePlatform(1500, null) // 15% — over the 10% cap
                    .accountsStrict({
                        platformConfig: platformConfigPDA,
                        authority: authority.publicKey,
                    })
                    .signers([authority])
                    .rpc();
                expect.fail("Should have thrown FeeTooHigh error");
            } catch (err: any) {
                expect(err.toString()).to.include("FeeTooHigh");
            }
        });
    });
});
