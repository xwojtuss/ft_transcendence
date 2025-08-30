import { authenticator } from "otplib";
import { CRYPTO_ALGORITHM, CRYPTO_IV_BYTES, TFA_EMAIL_EXPIRATION_SECONDS, TFA_TOKEN_EXPIRY } from "./config.js";
import { db } from "../server.js";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { getUserById, getUsersPhoneNumber } from "../db/dbQuery.js";
import HTTPError from "./error.js";
import { StatusCodes } from "http-status-codes";
import { SMSAPI } from "smsapi";

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
    #expiresAt = null;

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
        if (!this.#encryptedSecret) {
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
     * Generate the user-specific 2FA TOTP secret
     */
    generateSecret() {
        this.#secret = authenticator.generateSecret();
    }

    /**
     * Generate a one time code for email or sms 2FA, sets the secret
     */
    generateOTP() {
        if (this.#type !== 'email' && this.#type !== 'sms') return;
        this.#secret = crypto.randomInt(100000, 999999).toString();
    }

    /**
     * Regenerate the code, encrypt it and update it in the database
     * @param {boolean} isPending if true we update pending_tfas, otherwise tfas
     */
    async regenerateOTP(isPending) {
        if (this.#type !== 'email' && this.#type !== 'sms') return;
        this.#encryptedSecret = null;
        this.#tag = null;
        this.#iv = null;
        this.generateOTP();
        this.#encryptSecret();
        if (isPending) {
            db.run("UPDATE pending_tfas SET encrypted_secret = ?, tag = ?, iv = ? WHERE user_id = ?",
                this.#encryptedSecret,
                this.#tag,
                this.#iv,
                this.#userId
            );
        } else {
            db.run("UPDATE tfas SET encrypted_secret = ?, tag = ?, iv = ? WHERE user_id = ?",
                this.#encryptedSecret,
                this.#tag,
                this.#iv,
                this.#userId
            );
        }
    }

    /**
     * Encrypt the user-specific 2FA secret
     */
    #encryptSecret() {
        try {
            if (this.#encryptedSecret || this.#iv || this.#tag) return;
            if (!this.#secret && this.#type === 'totp') {
                this.generateSecret();
            } else if (!this.#secret && (this.#type === 'email' || this.#type === 'sms')) {
                this.generateOTP();
            }
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
        if (this.#type === 'totp') {
            return authenticator.check(code, this.secret);
        } else if (this.#type === 'email' || this.#type === 'sms') {
            if (this.#expiresAt == null || Date.now() > this.#expiresAt || this.secret !== code) {
                return false;
            } else {
                this.#secret = null;
                return true;
            }
        }
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
     * @param {{ type: string, encrypted_secret: string, iv: string, tag: string, expires_at: number }} response the database response
     */
    #formFromResponse(response) {
        this.#type = response.type;
        this.#encryptedSecret = response.encrypted_secret;
        this.#iv = response.iv;
        this.#tag = response.tag;
        this.#expiresAt = response.expires_at;
    }

    static #emailTransporter = nodemailer.createTransport({
        service: "Gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.TFA_EMAIL_EMAIL,
            pass: process.env.TFA_EMAIL_PASSWORD,
        }
    });

    /**
     * Get the email content, subject and sender and receiver
     * @param {string} email the email to send the email to
     * @returns {Promise<{
     *     from: string | undefined;
     *     to: string;
     *     subject: string;
     *     text: string;
     * }>} the email options
     */
    async #getEmailOptions(email) {
        email = email ? email : (await getUserById(this.#userId)).email;
        return {
            from: process.env.TFA_EMAIL_EMAIL,
            to: email,
            subject: "Verify your identity",
            text: `Hello,
To complete your action, please enter the following verification code:
${this.secret}
The code is valid for 10 minutes.`
        };
    }

    /**
     * Send the verification email
     * @param {string} email the email address to send it to
     * @throws {HTTPError} INTERNAL_SERVER_ERROR if the email could not be sent
     */
    async sendEmail(email) {
        if (this.#type !== 'email') return;

        try {
            await TFA.#emailTransporter.sendMail(await this.#getEmailOptions(email));
        } catch (error) {
            console.error("Error sending email: ", error);
            this.#secret = null;
            throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
        await this.#updateExpirationDate();
    }

    static #smsapi = new SMSAPI(process.env.TFA_SMS_OAUTH);

    /**
     * Send the verification SMS
     * @param {string} phoneNumber the number to send it to
     * @throws {HTTPError} INTERNAL_SERVER_ERROR if the SMS could not be sent
     */
    async sendSMS(phoneNumber) {
        if (this.#type !== 'sms') return;

        try {
            const safePhoneNumber = phoneNumber ? phoneNumber : await getUsersPhoneNumber(this.#userId);
            await TFA.#smsapi.sms.sendSms(safePhoneNumber, `Hello,
To complete your action, please enter the following verification code:
${this.secret}
The code is valid for 10 minutes.`)
        } catch (error) {
            console.error("Error sending SMS: ", error);
            this.#secret = null;
            throw new HTTPError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
        }
        await this.#updateExpirationDate();
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
    static TFAtypes = new Map([["disabled", "Disabled"], ["totp", "Authenticator App"], ["email", "Email"], ["sms", "SMS"]]);

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
     * @returns {Promise<TFA>} the TFA of the user
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
     * @returns {Promise<TFA | null>} the pending TFA of the user or null
     */
    static async getUsersPendingTFA(userId) {
        const response = await db.get("SELECT * FROM pending_tfas WHERE user_id = ?", userId);
        const userTFA = new TFA(userId);

        if (!response) {
            return null;
        }
        userTFA.#formFromResponse(response);
        return userTFA;
    }

    /**
     * Get the TFA from the pending user info update
     * @param {number} userId id of a user with the pending update
     * @returns {Promise<TFA>} the uncommited, non-pending TFA
     */
    static async getPendingUpdateTFA(userId) {
        const response = await db.get("SELECT tfa_type FROM pending_updates WHERE user_id = ?", userId);

        if (!response || !response.tfa_type) {
            return null;
        }
        const userTFA = new TFA(userId, response.tfa_type);
        return userTFA;
    }

    /**
     * Update the expiration date of a code
     */
    async #updateExpirationDate() {
        this.#expiresAt = Date.now() + TFA_EMAIL_EXPIRATION_SECONDS * 1000;
        let usersTFA = await TFA.getUsersTFA(this.#userId);
        if (usersTFA && usersTFA.type !== 'disabled' && usersTFA.type === this.#type) {
            await db.run("UPDATE tfas SET expires_at = ? WHERE user_id = ?", this.#expiresAt, this.#userId);
            return;
        }
        usersTFA = await TFA.getUsersPendingTFA(this.#userId);
        if (usersTFA && usersTFA.type !== 'disabled' && usersTFA.type === this.#type) {
            await db.run("UPDATE pending_tfas SET expires_at = ? WHERE user_id = ?", this.#expiresAt, this.#userId);
            return;
        }
    }
}
