/**
 * Ikki Escrow V2 SDK
 *
 * TypeScript helpers for interacting with the on-chain ikki_escrow_v2 program.
 * Supports SPL Token and Token-2022, plus NFT escrow creation.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import type { IkkiEscrowV2 } from "./ikki_escrow_v2";
export declare function validateTokenAccount(connection: anchor.web3.Connection, tokenAccount: PublicKey, expectedOwner: PublicKey, expectedMint: PublicKey): Promise<void>;
export declare function findPlatformConfigPDA(programId: PublicKey): [PublicKey, number];
export declare function findEscrowPDA(duelId: Buffer, programId: PublicKey): [PublicKey, number];
export declare function findVaultPDA(duelId: Buffer, programId: PublicKey): [PublicKey, number];
/**
 * Convert a UUID string into a 16-byte Buffer suitable for the duel_id field.
 */
export declare function uuidToBytes(uuid: string): Buffer;
export declare class IkkiEscrowV2SDK {
    program: Program<IkkiEscrowV2>;
    provider: AnchorProvider;
    constructor(program: Program<IkkiEscrowV2>, provider: AnchorProvider);
    get programId(): PublicKey;
    initializePlatform(authority: Keypair, treasury: PublicKey, feeBps: number): Promise<string>;
    updatePlatform(authority: Keypair, newFeeBps?: number, newTreasury?: PublicKey): Promise<string>;
    createEscrow(player1: Keypair, duelId: Buffer, stakeAmount: BN, tokenMint: PublicKey, expiryTimestamp: BN, player1TokenAccount: PublicKey, tokenProgram?: PublicKey): Promise<string>;
    createNftEscrow(player1: Keypair, duelId: Buffer, tokenMint: PublicKey, expiryTimestamp: BN, player1TokenAccount: PublicKey, tokenProgram?: PublicKey): Promise<string>;
    joinEscrow(player2: Keypair, duelId: Buffer, player2TokenAccount: PublicKey): Promise<string>;
    settleEscrow(authority: Keypair, duelId: Buffer, winner: PublicKey, winnerTokenAccount: PublicKey, treasuryTokenAccount: PublicKey): Promise<string>;
    disputeEscrow(authority: Keypair, duelId: Buffer): Promise<string>;
    resolveDispute(authority: Keypair, duelId: Buffer, winner: PublicKey, winnerTokenAccount: PublicKey, treasuryTokenAccount: PublicKey): Promise<string>;
    cancelEscrow(player1: Keypair, duelId: Buffer, player1TokenAccount: PublicKey): Promise<string>;
    claimExpired(cranker: Keypair, duelId: Buffer, player1TokenAccount: PublicKey): Promise<string>;
    fetchPlatformConfig(): Promise<{
        authority: anchor.web3.PublicKey;
        feeBps: number;
        treasury: anchor.web3.PublicKey;
        bump: number;
    }>;
    fetchEscrow(duelId: Buffer): Promise<{
        duelId: number[];
        player1: anchor.web3.PublicKey;
        player2: anchor.web3.PublicKey;
        stakeAmount: anchor.BN;
        tokenMint: anchor.web3.PublicKey;
        status: ({
            active?: undefined;
            disputed?: undefined;
            settled?: undefined;
            cancelled?: undefined;
        } & {
            open: Record<string, never>;
        }) | ({
            open?: undefined;
            disputed?: undefined;
            settled?: undefined;
            cancelled?: undefined;
        } & {
            active: Record<string, never>;
        }) | ({
            open?: undefined;
            active?: undefined;
            settled?: undefined;
            cancelled?: undefined;
        } & {
            disputed: Record<string, never>;
        }) | ({
            open?: undefined;
            active?: undefined;
            disputed?: undefined;
            cancelled?: undefined;
        } & {
            settled: Record<string, never>;
        }) | ({
            open?: undefined;
            active?: undefined;
            disputed?: undefined;
            settled?: undefined;
        } & {
            cancelled: Record<string, never>;
        });
        winner: anchor.web3.PublicKey;
        expiry: anchor.BN;
        bump: number;
        isNft: boolean;
        tokenProgramId: anchor.web3.PublicKey;
    }>;
}
export default IkkiEscrowV2SDK;
