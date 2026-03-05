"use strict";
/**
 * Ikki Escrow SDK
 *
 * TypeScript helpers for interacting with the on-chain ikki_escrow program.
 * Import this from the server when wiring up on-chain calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IkkiEscrowSDK = void 0;
exports.findPlatformConfigPDA = findPlatformConfigPDA;
exports.findEscrowPDA = findEscrowPDA;
exports.findVaultPDA = findVaultPDA;
exports.uuidToBytes = uuidToBytes;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
// ─── PDA Derivation ─────────────────────────────────────────────────────────────
function findPlatformConfigPDA(programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("platform_config")], programId);
}
function findEscrowPDA(duelId, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("escrow"), duelId], programId);
}
function findVaultPDA(duelId, programId) {
    return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("vault"), duelId], programId);
}
/**
 * Convert a UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 * into a 16-byte Buffer suitable for the duel_id field.
 */
function uuidToBytes(uuid) {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32)
        throw new Error("Invalid UUID length");
    return Buffer.from(hex, "hex");
}
// ─── SDK Class ──────────────────────────────────────────────────────────────────
class IkkiEscrowSDK {
    constructor(program, provider) {
        this.program = program;
        this.provider = provider;
    }
    get programId() {
        return this.program.programId;
    }
    // ── Platform ────────────────────────────────────────────────────────────
    async initializePlatform(authority, treasury, feeBps) {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);
        const tx = await this.program.methods
            .initializePlatform(feeBps)
            .accountsStrict({
            authority: authority.publicKey,
            platformConfig: platformConfigPDA,
            treasury,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([authority])
            .rpc();
        return tx;
    }
    async updatePlatform(authority, newFeeBps, newTreasury) {
        const [platformConfigPDA] = findPlatformConfigPDA(this.programId);
        const tx = await this.program.methods
            .updatePlatform(newFeeBps !== undefined ? newFeeBps : null, newTreasury !== undefined ? newTreasury : null)
            .accountsStrict({
            platformConfig: platformConfigPDA,
            authority: authority.publicKey,
        })
            .signers([authority])
            .rpc();
        return tx;
    }
    // ── Escrow Lifecycle ────────────────────────────────────────────────────
    async createEscrow(player1, duelId, stakeAmount, tokenMint, expiryTimestamp, player1TokenAccount) {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);
        const duelIdArray = Array.from(duelId);
        const tx = await this.program.methods
            .createEscrow(duelIdArray, stakeAmount, expiryTimestamp)
            .accountsStrict({
            player1: player1.publicKey,
            escrow: escrowPDA,
            tokenMint,
            player1TokenAccount,
            vault: vaultPDA,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.SystemProgram.programId,
            rent: web3_js_1.SYSVAR_RENT_PUBKEY,
        })
            .signers([player1])
            .rpc();
        return tx;
    }
    async joinEscrow(player2, duelId, player2TokenAccount) {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);
        const tx = await this.program.methods
            .joinEscrow()
            .accountsStrict({
            player2: player2.publicKey,
            escrow: escrowPDA,
            player2TokenAccount,
            vault: vaultPDA,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([player2])
            .rpc();
        return tx;
    }
    async settleEscrow(authority, duelId, winner, winnerTokenAccount, treasuryTokenAccount) {
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
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
        return tx;
    }
    async disputeEscrow(authority, duelId) {
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
    async resolveDispute(authority, duelId, winner, winnerTokenAccount, treasuryTokenAccount) {
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
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([authority])
            .rpc();
        return tx;
    }
    async cancelEscrow(player1, duelId, player1TokenAccount) {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);
        const tx = await this.program.methods
            .cancelEscrow()
            .accountsStrict({
            player1: player1.publicKey,
            escrow: escrowPDA,
            vault: vaultPDA,
            player1TokenAccount,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([player1])
            .rpc();
        return tx;
    }
    async claimExpired(cranker, duelId, player1TokenAccount) {
        const [escrowPDA] = findEscrowPDA(duelId, this.programId);
        const [vaultPDA] = findVaultPDA(duelId, this.programId);
        const tx = await this.program.methods
            .claimExpired()
            .accountsStrict({
            cranker: cranker.publicKey,
            escrow: escrowPDA,
            vault: vaultPDA,
            player1TokenAccount,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
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
    async fetchEscrow(duelId) {
        const [pda] = findEscrowPDA(duelId, this.programId);
        return this.program.account.escrowAccount.fetch(pda);
    }
}
exports.IkkiEscrowSDK = IkkiEscrowSDK;
exports.default = IkkiEscrowSDK;
