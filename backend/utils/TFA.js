import { authenticator } from "otplib";
import { CRYPTO_ALGORITHM, CRYPTO_IV_BYTES, TFA_TOKEN_EXPIRY } from "./config.js";
import { db } from "../server.js";
import crypto from "node:crypto";

export default class TFA {
    #userId = -1;
    #type = 'disabled';
    #encryptedSecret = null;
    #secret = null;
    #iv = null;
    #tag = null;

    constructor(userId, type) {
        this.#userId = userId;
        if (type) this.#type = type;
    }

    async makePending(originalTFA) {
        if (this.#userId !== originalTFA.userId || this.#type === originalTFA.type) return false;
        if (this.#type === 'disabled') {
            await TFA.disableTFA(this.#userId);
            return false;
        }
        if (!this.#encryptedSecret && this.#type === 'totp') {
            this.#encryptSecret();
        }
        await TFA.addPendingTFA(this);
        return true;
    }

    generateJWT(fastify, status) {
        const tfaToken = fastify.jwt.sign({
            id: this.#userId,
            type: this.#type,
            status: status
        }, process.env.TFA_TOKEN_SECRET, {
            expiresIn: TFA_TOKEN_EXPIRY
        });
        return tfaToken;
    }

    async commit() {
        await TFA.commitPendingTFA(this.#userId);
    }

    generateSecret() {
        this.#secret = authenticator.generateSecret();
    }

    #encryptSecret() {
        try {
            if (this.#encryptedSecret || this.#iv || this.#tag) return;
            if (!this.#secret) this.generateSecret();
            this.#iv = crypto.randomBytes(CRYPTO_IV_BYTES).toString('base64');
            const cipher = crypto.createCipheriv(
                CRYPTO_ALGORITHM,
                Buffer.from(process.env.CRYPTO_TFA_KEY, 'base64'),
                Buffer.from(this.#iv, 'base64')
            );
            this.#encryptedSecret = cipher.update(this.#secret, 'utf8', 'base64');
            this.#encryptedSecret += cipher.final('base64');
            this.#tag = cipher.getAuthTag().toString('base64');
        } catch (error) {
            console.error(error);
        }
    }

    #decryptSecret() {
        try {
            if (!this.#encryptedSecret || !this.#iv || !this.#tag) return;
            const decipher = crypto.createDecipheriv(
                CRYPTO_ALGORITHM,
                Buffer.from(process.env.CRYPTO_TFA_KEY, 'base64'),
                Buffer.from(this.#iv, 'base64')
            );
            decipher.setAuthTag(Buffer.from(this.#tag, 'base64'));
            this.#secret = decipher.update(this.#encryptedSecret, 'base64', 'utf8');
            this.#secret += decipher.final('utf8');
        } catch (error) {
            console.error(error);
        }
    }

    prettyTypeName() {
        return TFA.TFAtypes.get(this.#type) || "Unknown";
    }

    #formFromResponse(response) {
        this.#type = response.type;
        this.#encryptedSecret = response.encrypted_secret;
        this.#iv = response.iv;
        this.#tag = response.tag;
    }

    get secret() {
        if (this.#secret) return this.#secret;
        this.#decryptSecret();
        return this.#secret;
    }

    get type() {
        return this.#type;
    }

    set type(type) {
        this.#type = type;
    }

    get userId() {
        return this.#userId;
    }

    /**
     * A map of 2FA types to their display names.
     * Key: {string}
     * Value: {string}
     */
    static TFAtypes = new Map([["disabled", "Disabled"], ["totp", "Authenticator App"], ["email", "Email"]]);

    /**
     * Disables the 2FA for a user
     * @param {number} userId the id of the user whose 2FA to disable
     */
    static async disableTFA(userId) {
        try {
            await db.run("DELETE FROM tfas WHERE user_id = ?", userId);
        } catch (error) {}
    }

    static async addPendingTFA(userTFA) {
        await TFA.removePendingTFA(userTFA.#userId);
        await db.run("INSERT INTO pending_tfas (user_id, type, encrypted_secret, iv, tag) VALUES (?, ?, ?, ?, ?)",
            userTFA.#userId, userTFA.#type, userTFA.#encryptedSecret, userTFA.#iv, userTFA.#tag
        );
    }

    static async removePendingTFA(userId) {
        try {
            await db.run("DELETE FROM pending_tfas WHERE user_id = ?", userId);
        } catch (error) {}
    }

    static async commitPendingTFA(userId) {
        const userTFA = await TFA.getUsersPendingTFA(userId);
        await TFA.disableTFA(userId);
        await TFA.removePendingTFA(userId);
        if (userTFA.#type === 'disabled') return;
        await db.run("INSERT INTO tfas (user_id, type, encrypted_secret, iv, tag) VALUES (?, ?, ?, ?, ?)",
            userTFA.#userId, userTFA.#type, userTFA.#encryptedSecret, userTFA.#iv, userTFA.#tag
        );
    }

    static async getUsersTFA(userId) {
        const response = await db.get("SELECT * FROM tfas WHERE user_id = ?", userId);
        const userTFA = new TFA(userId);

        if (!response) {
            userTFA.type = 'disabled';
            return userTFA;
        }
        userTFA.#formFromResponse(response);
        return userTFA;
    }

    static async getUsersPendingTFA(userId) {
        const response = await db.get("SELECT * FROM pending_tfas WHERE user_id = ?", userId);
        const userTFA = new TFA(userId);

        if (!response) {
            userTFA.type = 'disabled';
            return userTFA;
        }
        userTFA.#formFromResponse(response);
        return userTFA;
    }
}
