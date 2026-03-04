/**
 * Ikki Escrow SDK
 *
 * TypeScript helpers for interacting with the on-chain ikki_escrow program.
 * Import this from the server when wiring up on-chain calls.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
    PublicKey,
    Keypair,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { IkkiEscrow } from "../target/types/ikki_escrow";

// ─── PDA Derivation ─────────────────────────────────────────────────────────────

export function findPlatformConfigPDA(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        programId,
    );
}

export function findEscrowPDA(
    duelId: Buffer,
    programId: PublicKey,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), duelId],
        programId,
    );
}

export function findVaultPDA(
    duelId: Buffer,
    programId: PublicKey,
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), duelId],
        programId,
    );
}

/**
 * Convert a UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 * into a 16-byte Buffer suitable for the duel_id field.
 */
export function uuidToBytes(uuid: string): Buffer {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) throw new Error("Invalid UUID length");
    return Buffer.from(hex, "hex");
}

// ─── SDK Class ──────────────────────────────────────────────────────────────────

export class IkkiEscrowSDK {
    public program: Program<IkkiEscrow>;
    public provider: AnchorProvider;

    constructor(program: Program<IkkiEscrow>, provider: AnchorProvider) {
        this.program = program;
        this.provider = provider;
    }

    get programId(): PublicKey {
        return this.program.programId;
    }

    // ── Platform ────────────────────────────────────────────────────────────

    async initializePlatform(
        authority: Keypair,
        treasury: PublicKey,
        feeBps: number,
    ): Promise<string> {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);

        const tx = await this.program.methods
            .initializePlatform(feeBps)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                treasury,
                systemProgram: SystemProgram.programId,
            })
            .signers([authority])
            .rpc();

        return tx;
    }

    async updatePlatform(
        authority: Keypair,
        newFeeBps?: number,
        newTreasury?: PublicKey,
    ): Promise<string> {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);

        const tx = await this.program.methods
            .updatePlatform(
                newFeeBps !== undefined ? newFeeBps : null,
                newTreasury !== undefined ? newTreasury : null,
            )
            .accountsStrict({
                platformConfig: platformConfigPDA,
                authority: authority.publicKey,
            })
            .signers([authority])
            .rpc();

        return tx;
    }

    // ── Escrow Lifecycle ────────────────────────────────────────────────────

    async createEscrow(
        player1: Keypair,
        duelId: Buffer,
        stakeAmount: BN,
        tokenMint: PublicKey,
        expiryTimestamp: BN,
        player1TokenAccount: PublicKey,
    ): Promise<string> {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const duelIdArray = Array.from(duelId);

        const tx = await this.program.methods
            .createEscrow(duelIdArray as any, stakeAmount, expiryTimestamp)
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
            })
            .signers([player1])
            .rpc();

        return tx;
    }

    async joinEscrow(
        player2: Keypair,
        duelId: Buffer,
        player2TokenAccount: PublicKey,
    ): Promise<string> {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const tx = await this.program.methods
            .joinEscrow()
            .accountsStrict({
                player2: player2.publicKey,
                escrow: escrowPDA,
                player2TokenAccount,
                vault: vaultPDA,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player2])
            .rpc();

        return tx;
    }

    async settleEscrow(
        authority: Keypair,
        duelId: Buffer,
        winner: PublicKey,
        winnerTokenAccount: PublicKey,
        treasuryTokenAccount: PublicKey,
    ): Promise<string> {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const tx = await this.program.methods
            .settleEscrow(winner)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
                vault: vaultPDA,
                winnerTokenAccount,
                treasuryTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        return tx;
    }

    async disputeEscrow(
        authority: Keypair,
        duelId: Buffer,
    ): Promise<string> {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);

        const tx = await this.program.methods
            .disputeEscrow()
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
            })
            .signers([authority])
            .rpc();

        return tx;
    }

    async resolveDispute(
        authority: Keypair,
        duelId: Buffer,
        winner: PublicKey,
        winnerTokenAccount: PublicKey,
        treasuryTokenAccount: PublicKey,
    ): Promise<string> {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const tx = await this.program.methods
            .resolveDispute(winner)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
                vault: vaultPDA,
                winnerTokenAccount,
                treasuryTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([authority])
            .rpc();

        return tx;
    }

    async cancelEscrow(
        player1: Keypair,
        duelId: Buffer,
        player1TokenAccount: PublicKey,
    ): Promise<string> {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const tx = await this.program.methods
            .cancelEscrow()
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                vault: vaultPDA,
                player1TokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([player1])
            .rpc();

        return tx;
    }

    async claimExpired(
        cranker: Keypair,
        duelId: Buffer,
        player1TokenAccount: PublicKey,
    ): Promise<string> {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const tx = await this.program.methods
            .claimExpired()
            .accountsStrict({
                cranker: cranker.publicKey,
                escrow: escrowPDA,
                vault: vaultPDA,
                player1TokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([cranker])
            .rpc();

        return tx;
    }

    // ── Fetch helpers ───────────────────────────────────────────────────────

    async fetchPlatformConfig() {
        const [pda] = findPlatformConfigPDA(this.programId);
        return this.program.account.platformConfig.fetch(pda);
    }

    async fetchEscrow(duelId: Buffer) {
        const [pda] = findEscrowPDA(duelId, this.programId);
        return this.program.account.escrowAccount.fetch(pda);
    }
}

export default IkkiEscrowSDK;
