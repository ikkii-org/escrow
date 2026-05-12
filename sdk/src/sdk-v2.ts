/**
 * Ikkii Escrow V2 SDK
 *
 * TypeScript helpers for interacting with the on-chain ikkii_escrow_v2 program.
 * Supports SPL Token and Token-2022, plus NFT escrow creation.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import {
    PublicKey,
    Keypair,
    SystemProgram,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAccount,
} from "@solana/spl-token";
import type { IkkiiEscrowV2 } from "./ikkii_escrow_v2";

export async function validateTokenAccount(
    connection: anchor.web3.Connection,
    tokenAccount: PublicKey,
    expectedOwner: PublicKey,
    expectedMint: PublicKey,
): Promise<void> {
    try {
        const account = await getAccount(connection, tokenAccount);
        if (account.owner.toBase58() !== expectedOwner.toBase58()) {
            throw new Error(
                `Token account owner mismatch: expected ${expectedOwner.toBase58()}, got ${account.owner.toBase58()}`
            );
        }
        if (account.mint.toBase58() !== expectedMint.toBase58()) {
            throw new Error(
                `Token account mint mismatch: expected ${expectedMint.toBase58()}, got ${account.mint.toBase58()}`
            );
        }
    } catch (err) {
        if (err instanceof Error) throw err;
        throw new Error(`Invalid token account: ${err}`);
    }
}

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
 * Convert a UUID string into a 16-byte Buffer suitable for the duel_id field.
 */
export function uuidToBytes(uuid: string): Buffer {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
        throw new Error("Invalid UUID format");
    }
    const hex = uuid.replace(/-/g, "");
    return Buffer.from(hex, "hex");
}

// ─── SDK Class ──────────────────────────────────────────────────────────────────

export class IkkiiEscrowV2SDK {
    public program: Program<IkkiiEscrowV2>;
    public provider: AnchorProvider;

    constructor(program: Program<IkkiiEscrowV2>, provider: AnchorProvider) {
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
        tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
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
                tokenProgram,
                systemProgram: SystemProgram.programId,
            })
            .signers([player1])
            .rpc();

        return tx;
    }

    async createNftEscrow(
        player1: Keypair,
        duelId: Buffer,
        tokenMint: PublicKey,
        expiryTimestamp: BN,
        player1TokenAccount: PublicKey,
        tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
    ): Promise<string> {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);

        const duelIdArray = Array.from(duelId);
        const stakeAmount = new BN(1);

        const tx = await this.program.methods
            .createNftEscrow(duelIdArray as any, stakeAmount, expiryTimestamp)
            .accountsStrict({
                player1: player1.publicKey,
                escrow: escrowPDA,
                tokenMint,
                player1TokenAccount,
                vault: vaultPDA,
                tokenProgram,
                systemProgram: SystemProgram.programId,
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

        const escrow = await this.fetchEscrow(duelId);
        const platformConfig = await this.fetchPlatformConfig();

        await validateTokenAccount(
            this.provider.connection,
            winnerTokenAccount,
            winner,
            escrow.tokenMint,
        );
        await validateTokenAccount(
            this.provider.connection,
            treasuryTokenAccount,
            platformConfig.treasury,
            escrow.tokenMint,
        );

        const tx = await this.program.methods
            .settleEscrow(winner)
            .accountsStrict({
                authority: authority.publicKey,
                platformConfig: platformConfigPDA,
                escrow: escrowPDA,
                vault: vaultPDA,
                winnerTokenAccount,
                treasuryTokenAccount,
                tokenProgram: escrow.tokenProgramId,
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
        return this.program.account.escrowAccountV2.fetch(pda);
    }
}

export default IkkiiEscrowV2SDK;
