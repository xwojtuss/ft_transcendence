import { db } from "../buildApp.js";
import User from "../utils/User.js";
import Match from "../utils/Match.js";

export default async function getAllUsers() {
    try {
        const users = await db.all("SELECT * FROM users");
        return users;
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * Recreate a user from an Object
 * @param {Object} userObject the Object, for example the result of a db query
 * @example
 * const result = await db.get('SELECT * FROM users WHERE user_id = 1');
 * const user = createUserFromObject(result);
 * // user is a User instance
 * user.validatePassword(...);
 * @returns the User instance
 */
export function createUserFromObject(userObject) {
    const userInstance = new User(userObject.nickname, userObject.password);
    userInstance.email = userObject.email;
    userInstance.isOnline = userObject.is_online;
    userInstance.avatar = userObject.avatar;
    userInstance.phoneNumber = userObject.phone_number;
    userInstance.won_games = userObject.won_games;
    userInstance.lost_games = userObject.lost_games;
    userInstance.id = userObject.user_id;
    return userInstance;
}

/**
 * Get a User instance from a nickname
 * @param {string} nickname the nickname of the user to get
 * @returns {Promise<User | null>} the User instance or null if doesn't exist
 * @throws {Error} if query failed
 */
export async function getUser(nickname) {
    try {
        const user = await db.get("SELECT * FROM users WHERE nickname=? LIMIT 1", nickname);
        if (!user || user.empty)
            return null;
        return createUserFromObject(user);
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * Get a user from db by using an email
 * @param {string} email the email of the user to get
 * @returns {Promise<User | null>} the User instance with that email or null if doesn't exist
 * @throws {Error} if query failed
 */
export async function getUserByEmail(email) {
    try {
        const user = await db.get("SELECT * FROM users WHERE email=? LIMIT 1", email);
        if (!user || user.empty)
            return null;
        return createUserFromObject(user);
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * For testing purposes only
 * @returns 
 */
export async function getAllMatchHistory() {
    try {
        const matches = await db.all("SELECT * FROM match_history");
        return matches;
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * For testing purposes only
 * @returns 
 */
export async function getAllMatches() {
    try {
        const matches = await db.all("SELECT * FROM participants");
        return matches;
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * Adds a user to the db, they have to have: nickname, password and email assigned
 * @param {User} user the user instance
 * @returns {Promise<number>} the id of the created user
 * @throws {Error} if query failed
 */
export async function addUser(user) {
    try {
        const result = await db.run(
            "INSERT INTO users (nickname, password, email) VALUES (?, ?, ?)",
            user.nickname,
            user.password,
            user.email
        );
        return result.lastID;
    } catch (error) {
        throw new Error("Insert failed");
    }
}

/**
 * Updates the non-2FA data related to a user, this updates nickname, email, password, avatar and phone number
 * @param {User} originalUser the instance of a user with unchanged data (nickname and email must match with db)
 * @param {User} updatedUser the instance of a user with the changes to commit
 */
export async function updateUser(originalUser, updatedUser) {
    await db.get(`
        UPDATE users
        SET nickname = ?, password = ?, email = ?, avatar = ?, phone_number = ?
        WHERE nickname = ? AND email = ?`,
        updatedUser.nickname, updatedUser.password, updatedUser.email, updatedUser.avatar, updatedUser.phoneNumber,
        originalUser.nickname, originalUser.email
    );
}

/**
 * Get the user instance by using an id
 * @param {number} userId the user index
 * @returns {Promise<User | null>} the user or null if not found
 * @throws {Error} if the query fails
 */
export async function getUserById(userId) {
    try {
        const user = await db.get("SELECT * FROM users WHERE user_id=? LIMIT 1", userId);
        if (!user || user.empty)
            return null;
        return createUserFromObject(user);
    } catch (error) {
        throw new Error("Database query failed");
    }
}

/**
 * Returns the updatedValue if it's different from the originalValue, otherwise null
 * @param {*} originalValue
 * @param {*} updatedValue
 * @returns
 */
function getUpdatedValueOrNull(originalValue, updatedValue) {
    if (updatedValue !== null && updatedValue !== undefined && originalValue !== updatedValue) {
        return updatedValue;
    }
    return null;
}

/**
 * Returns the updatedValue if it's different from the originalValue, otherwise originalValue
 * @param {*} originalValue
 * @param {*} updatedValue
 * @returns
 */
function getUpdatedValueOrOriginal(originalValue, updatedValue) {
    if (updatedValue !== null && updatedValue !== undefined && originalValue !== updatedValue) {
        return updatedValue;
    }
    return originalValue;
}

/**
 * Add a pending update to the db, in case we need to authorize the user before commiting the changes
 * @param {User} originalUser the user whose data match with what is in the database
 * @param {User} updatedUser the user with the changes made
 * @param {string} originalTFAtype the original 2FA type
 * @param {string} updatedTFAtype the new 2FA type
 * @throws {Error} if the query fails
 */
export async function addPendingUpdate(originalUser, updatedUser, originalTFAtype, updatedTFAtype) {
    try {
        await db.run("DELETE FROM pending_updates WHERE user_id = ?", originalUser.id);
    } catch (error) {}
    try {
        await db.run(
            "INSERT INTO pending_updates (user_id, nickname, password, email, avatar, phone_number, tfa_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            originalUser.id,
            getUpdatedValueOrNull(originalUser.nickname, updatedUser.nickname),
            getUpdatedValueOrNull(originalUser.password, updatedUser.password),
            getUpdatedValueOrNull(originalUser.email, updatedUser.email),
            getUpdatedValueOrNull(originalUser.avatar, updatedUser.avatar),
            getUpdatedValueOrNull(originalUser.phoneNumber, updatedUser.phoneNumber),
            getUpdatedValueOrNull(originalTFAtype, updatedTFAtype),
        );
    } catch (error) {
        throw new Error("Insert failed");
    }
}

/**
 * Check whether a user has an update pending
 * @param {number} userId the id of the user to check
 * @returns {Promise<boolean>}
 */
export async function hasPendingUpdate(userId) {
    const response = await db.get("SELECT * FROM pending_updates WHERE user_id = ?", userId);
    if (!response) return false;
    return true;
}

/**
 * Remove an update that is pending
 * @param {number} userId the id of the user whose update request to cancel
 */
export async function removePendingUpdate(userId) {
    try {
        await db.run("DELETE FROM pending_updates WHERE user_id = ?", userId);
    } catch (error) {}
}

/**
 * Commit the changes in the users' pending update to take effect, removes the pending update
 * @param {User} user this has to be the user whose data match with what's in the database
 * @throws {Error} if there is no data to update
 */
export async function commitPendingUpdate(user) {
    const response = await db.get("SELECT * FROM pending_updates WHERE user_id = ?", user.id);
    if (!response) throw new Error("No data to update");
    await db.get(`
        UPDATE users
        SET nickname = ?, password = ?, email = ?, avatar = ?, phone_number = ?
        WHERE nickname = ? AND email = ?`,
        getUpdatedValueOrOriginal(user.nickname, response.nickname),
        getUpdatedValueOrOriginal(user.password, response.password),
        getUpdatedValueOrOriginal(user.email, response.email),
        getUpdatedValueOrOriginal(user.avatar, response.avatar),
        getUpdatedValueOrOriginal(user.phoneNumber, response.phone_number),
        user.nickname,
        user.email
    );
    await removePendingUpdate(user.id);
}

/**
 * Check whether a pending update request has already taken a nickname
 * @param {string} nickname the nickname to check
 * @returns {Promise<boolean>}
 */
export async function isNicknamePending(nickname) {
    const response = await db.get("SELECT * FROM pending_updates WHERE nickname = ?", nickname);
    if (!response) return false;
    return true;
}

/**
 * Check whether a pending update request has already taken a email
 * @param {string} email the email to check
 * @returns {Promise<boolean>}
 */
export async function isEmailPending(email) {
    const response = await db.get("SELECT * FROM pending_updates WHERE email = ?", email);
    if (!response) return false;
    return true;
}

/**
 * Returns the phone number of a user
 * @param {number} userId the Id of the user
 * @returns the phone number if defined, otherwise null
 */
export async function getUsersPhoneNumber(userId) {
    const response = await db.get("SELECT phone_number FROM users WHERE user_id = ?", userId);
    if (!response || !response.phone_number) return null;
    return response.phone_number;
}

export async function setIsOnline(userId, isOnline) {
    await db.get(`
        UPDATE users
        SET is_online = ?
        WHERE user_id = ? AND is_online = ?`,
        isOnline,
        userId, !isOnline
    );
}