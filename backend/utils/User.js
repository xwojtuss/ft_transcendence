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

    async setPassword(password) {
        this._password = await bcrypt.hash(password, SALT_ROUNDS);
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
}