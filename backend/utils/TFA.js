import { authenticator } from "otplib";
import { CRYPTO_ALGORITHM, CRYPTO_IV_BYTES, TFA_TOKEN_EXPIRY } from "./config.js";
import { db } from "../server.js";
import crypto from "node:crypto";

/**
 * A class for Two Factor Authorization methods.
 * @example
 * const userTFA = new TFA(someUser.id, 'totp'); // creates a 2FA method for a user
 * if (await userTFA.makePending()) {
 *    // the user has to setup the 2FA method
 *    return reply.code(StatusCodes.ACCEPTED).send({
 *        jwtToken: userTFA.generateJWT(fastify, 'update');
 *    });
 * }
 * @example
 * // after we get the code from the user
 * const userTFA = await TFA.getUsersPendingTFA(someUser.id);
 * if (userTFA.verify(userInputCode)) { // check if the user code is correct
 *    await userTFA.commit(); // commit the pending changes
 * }
 */
export default class TFA {
    #userId = -1;
    #type = 'disabled';
    #encryptedSecret = null;
    #secret = null;
    #iv = null;
    #tag = null;

    /**
     * Create a new 2FA for a user
     * @param {number} userId the id of the user
     * @param {string} [type] the type of 2FA
     */
    constructor(userId, type) {
        this.#userId = userId;
        if (type) this.#type = type;
    }

    /**
     * Adds the 2FA method to the database to await verification
     * @param {TFA} originalTFA the TFA with the data that is currently in the db
     * @returns {Promise<boolean>} whether the 2FA method has to go through setup, if true is returned you need to send the JWT token to the client
     */
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

    /**
     * Generate the JWT 2FA token neccessary for checking or updating the 2FA method
     * @param {*} fastify the fastify instance
     * @param {string} status the status of the 2FA - whether we are 'check'ing it or 'update'ing it
     * @returns {string} the tfaToken
     */
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

    /**
     * Commit the pending TFA that is associated with this TFAs' userId
     */
    async commit() {
        await TFA.commitPendingTFA(this.#userId);
    }

    /**
     * Generate the user-specific 2FA secret
     */
    generateSecret() {
        this.#secret = authenticator.generateSecret();
    }

    /**
     * Encrypt the user-specific 2FA secret
     */
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

    /**
     * Decrypt the user-specific 2FA secret
     */
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

    /**
     * Check whether the code provided by a user is correct
     * @param {string} code the code provided by a user
     * @returns {boolean} whether the code is correct or not
     */
    verify(code) {
        return authenticator.check(code, this.secret);
    }

    /**
     * Get the URI for TOTP 2FA
     * @param {string} nickname the nickname that will show up in the authorization app
     * @returns {string} the URI
     */
    getURI(nickname) {
        return authenticator.keyuri(nickname, 'ft_transcendence', this.secret);
    }

    /**
     * Get the pretty name for the 2FA type
     * @returns {string} the frontend-ready type name
     */
    prettyTypeName() {
        return TFA.TFAtypes.get(this.#type) || "Unknown";
    }

    /**
     * Assign the encryption info and type of 2FA from a database response
     * @param {{ type: string, encrypted_secret: string, iv: string, tag: string }} response the database response
     */
    #formFromResponse(response) {
        this.#type = response.type;
        this.#encryptedSecret = response.encrypted_secret;
        this.#iv = response.iv;
        this.#tag = response.tag;
    }

    /**
     * Get the decrypted secret
     */
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

    /**
     * Adds a pending 2FA update
     * @param {TFA} userTFA the TFA to add
     * @throws {Error} if the insert fails
     */
    static async addPendingTFA(userTFA) {
        await TFA.removePendingTFA(userTFA.#userId);
        await db.run("INSERT INTO pending_tfas (user_id, type, encrypted_secret, iv, tag) VALUES (?, ?, ?, ?, ?)",
            userTFA.#userId, userTFA.#type, userTFA.#encryptedSecret, userTFA.#iv, userTFA.#tag
        );
    }

    /**
     * Removes a pending 2FA update
     * @param {number} userId the id of the user which pending 2FA update to remove
     */
    static async removePendingTFA(userId) {
        try {
            await db.run("DELETE FROM pending_tfas WHERE user_id = ?", userId);
        } catch (error) {}
    }

    /**
     * Commit the pending 2FA update
     * @param {number} userId the id of the user which pending 2FA update to commit
     */
    static async commitPendingTFA(userId) {
        const userTFA = await TFA.getUsersPendingTFA(userId);
        await TFA.disableTFA(userId);
        await TFA.removePendingTFA(userId);
        if (userTFA.#type === 'disabled') return;
        await db.run("INSERT INTO tfas (user_id, type, encrypted_secret, iv, tag) VALUES (?, ?, ?, ?, ?)",
            userTFA.#userId, userTFA.#type, userTFA.#encryptedSecret, userTFA.#iv, userTFA.#tag
        );
    }

    /**
     * Get the TFA of a user
     * @param {number} userId the userId of the user whose 2FA method to get
     * @returns {TFA} the TFA of the user
     */
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

    /**
     * Get the pending TFA of a user
     * @param {number} userId the userId of the user whose pending 2FA method to get
     * @returns {TFA} the pending TFA of the user
     */
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
