import { SALT_ROUNDS } from "./config.js";
import bcrypt from "bcrypt";

export default class User {
    #nickname = null;
    #isOnline = 1;
    #password = null;
    #email = null;
    #avatar = null;
    #won_games = 0;
    #lost_games = 0;
    #id = -42;

    /**
     * Create the user 
     * @param {string} nickname User nickname
     * @param {string} password Optional, you should only pass the hashed password here!
     */
    constructor(nickname, password) {
        this.#nickname = nickname;
        if (password)
            this.#password = password;
    }

    set isOnline(isOnline) {
        this.#isOnline = isOnline;
    }

    get nickname() {
        return this.#nickname;
    }

    get isOnline() {
        return this.#isOnline;
    }

    /**
     * Adds a password to the user and hashes it
     * @param {string} password Unhashed password
     */
    async setPassword(password) {
        this.#password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Check if the password is correct
     * @param {string} passwordTry Unhashed password to check
     * @returns {Promise<boolean>} Whether the password is correct or not
     */
    async validatePassword(passwordTry) {
        let isCorrect = false;
        try {
            isCorrect = await bcrypt.compare(passwordTry, this.#password);
        } catch (error) {
            isCorrect = false;
            return false;
        }
        return isCorrect;
    }

    get password() {
        return this.#password;
    }

    set email(email) {
        this.#email = email;
    }

    get email() {
        return this.#email;
    }

    set avatar(avatar) {
        this.#avatar = avatar;
    }

    get avatar() {
        return this.#avatar;
    }

    set won_games (won_games) {
        this.#won_games = won_games;
    }

    get won_games () {
        return this.#won_games;
    }

    set lost_games (lost_games) {
        this.#lost_games = lost_games;
    }

    get lost_games () {
        return this.#lost_games;
    }

    set id(id) {
        this.#id = id;
    }

    get id() {
        return this.#id;
    }
}