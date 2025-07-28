import { SALT_ROUNDS } from "./config.js";
import bcrypt from "bcrypt";

export default class User {
    _nickname = null;
    _isOnline = true;
    _password = null;
    _email = null;
    _avatar = null;

    constructor(nickname) {
        this._nickname = nickname;
    }

    set isOnline(isOnline) {
        this._isOnline = isOnline;
    }

    get nickname() {
        return this._nickname;
    }

    get isOnline() {
        return this._isOnline
    }

    async setPassword(password) {
        this._password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    get password() {
        return this._password
    }

    set email(email) {
        this._email = email;
    }

    get email() {
        return this._email
    }

    set avatar(avatar) {
        this._avatar = avatar;
    }

    get avatar() {
        return this._avatar
    }
}