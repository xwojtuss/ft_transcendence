import { SALT_ROUNDS } from "./config.js";
import bcrypt from "bcrypt";

export default class User {
    _nickname = null;
    _isOnline = true;
    _password = null;
    _email = null;
    _avatar = null;
    _won_games = 0;
    _lost_games = 0;
    _id = -42;
    _typeOfTFA = "disabled";
    _TFAsecret = null;

    /**
     * Create the user 
     * @param {string} nickname User nickname
     * @param {string} password Optional, you should only pass the hashed password here!
     */
    constructor(nickname, password) {
        this._nickname = nickname;
        if (password)
            this._password = password;
    }

    set isOnline(isOnline) {
        this._isOnline = isOnline;
    }

    get nickname() {
        return this._nickname;
    }

    get isOnline() {
        return this._isOnline;
    }

    /**
     * Adds a password to the user and hashes it
     * @param {string} password Unhashed password
     */
    async setPassword(password) {
        this._password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    /**
     * Check if the password is correct
     * @param {string} passwordTry Unhashed password to check
     * @returns {Promise<boolean>} Whether the password is correct or not
     */
    async validatePassword(passwordTry) {
        let isCorrect = false;
        try {
            isCorrect = await bcrypt.compare(passwordTry, this._password);
        } catch (error) {
            isCorrect = false;
            return false;
        }
        return isCorrect;
    }

    get password() {
        return this._password;
    }

    set email(email) {
        this._email = email;
    }

    get email() {
        return this._email;
    }

    set avatar(avatar) {
        this._avatar = avatar;
    }

    get avatar() {
        return this._avatar;
    }

    set won_games (won_games) {
        this._won_games = won_games;
    }

    get won_games () {
        return this._won_games;
    }

    set lost_games (lost_games) {
        this._lost_games = lost_games;
    }

    get lost_games () {
        return this._lost_games;
    }

    set id(id) {
        this._id = id;
    }

    get id() {
        return this._id;
    }

    set typeOfTFA(type) {
        this._typeOfTFA = type;
    }

    get typeOfTFA() {
        return this._typeOfTFA;
    }

    set TFAsecret(secret) {
        this._TFAsecret = secret;
    }

    get TFAsecret() {
        return this._TFAsecret;
    }
}