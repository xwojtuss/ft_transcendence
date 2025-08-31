import { db } from "../server.js";
import User from "../utils/User.js";
import Match from "../utils/Match.js";
import HTTPError from "../utils/error.js";
import { StatusCodes } from "http-status-codes";

export default async function getAllUsers() {
    try {
        const users = await db.all("SELECT * FROM users");
        return users;
    } catch (error) {
        console.error("Failed to fetch users:", error.message);
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
function createUserFromObject(userObject) {
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
        console.error("Failed to fetch user:", error.message);
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
        console.error("Failed to fetch user:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getAllMatchHistory() {
    try {
        const matches = await db.all("SELECT * FROM match_history");
        return matches;
    } catch (error) {
        console.error("Failed to fetch match history:", error.message);
        throw new Error("Database query failed");
    }
}

/**
 * Get the match history of a user
 * @param {string | User} user The user nickname or User
 * @returns {Promise<Map<number, Match>>} A map of [match.match_id, Match]
 * @throws {Error} if query failed
 */
export async function getUserMatchHistory(user) {
    const matchesMap = new Map();
    try {
        const matches = await db.all(`
            SELECT 
                match_history.match_id, 
                match_history.ended_at, 
                match_history.num_of_players, 
                users.nickname AS participant, 
                matches.is_originator, 
                matches.rank
            FROM match_history
            JOIN matches ON matches.match_id = match_history.match_id
            JOIN users ON users.user_id = matches.participant
            WHERE EXISTS (
                SELECT 1
                FROM matches m2
                JOIN users u2 ON u2.user_id = m2.participant
                WHERE m2.match_id = match_history.match_id
                AND u2.nickname = ?
            )
            ORDER BY matches.is_originator DESC;`, user.nickname || user);
        matches.forEach(match => {
            let matchInstance;
            if (matchesMap.has(match.match_id) === false) {
                matchInstance = new Match(match.participant, match.num_of_players);
                matchesMap.set(match.match_id, matchInstance);
                matchInstance.endedAt = match.ended_at;
            } else {
                matchInstance = matchesMap.get(match.match_id);
                matchInstance.addParticipant(match.participant);
            }
            matchInstance.addRank(match.participant, match.rank);
        });
        return matchesMap;
    } catch (error) {
        console.error("Failed to fetch match history:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getAllMatches() {
    try {
        const matches = await db.all("SELECT * FROM matches");
        return matches;
    } catch (error) {
        console.error("Failed to fetch matches:", error.message);
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
        console.error("Failed to insert user:", error.message);
        throw new Error("Insert failed");
    }
}

/**
 * Add a match to the db, the match has to be valid and has to have ended
 * @param {Match} match the match to add
 * @throws {Error} if insert has failed, rollbacks the changes
 */
export async function addMatch(match) {
    await db.exec("BEGIN TRANSACTION");
    try {
        const result = await db.run(
            "INSERT INTO match_history (ended_at, num_of_players) VALUES (?, ?)",
            match.endedAt,
            match.numOfPlayers
        );
        const matchID = result.lastID;
        for (const [player, rank] of match.participants.entries()) {
            const participant = await db.get("SELECT user_id FROM users WHERE nickname = ?", player.nickname);
            if (!participant)
                throw new Error("User not found");
            await db.run(
                "INSERT INTO matches (match_id, participant, is_originator, rank) VALUES (?, ?, ?, ?)",
                matchID,
                participant.user_id,
                (match.originator === player),
                rank
            );
        }
        await db.exec("COMMIT");
    } catch (error) {
        await db.exec("ROLLBACK");
        console.error("Failed to insert match:", error.message);
        throw new Error("Insert failed");
    }
}

/**
 * Check if two users are friends
 * @param {string | User} userOne Nickname of user or the User
 * @param {string | User} userTwo Nickname of the second user or the the second User
 * @returns {Promise<boolean>} Whether they are friends
 */
export async function areFriends(userOne, userTwo) {
    const relationship = await db.get(`
        SELECT u1.nickname AS originator_nickname,
            u2.nickname AS friended_nickname
        FROM friends_with
        JOIN users u1 ON u1.user_id = friends_with.originator
        JOIN users u2 ON u2.user_id = friends_with.friended
        WHERE is_invite = false
        AND ((u1.nickname = ? AND u2.nickname = ?) OR (u1.nickname = ? AND u2.nickname = ?))`,
        userOne.nickname || userOne, userTwo.nickname || userTwo, userTwo.nickname || userTwo, userOne.nickname || userOne);
    if (!relationship || !relationship.originator_nickname || !relationship.friended_nickname) {
        return false;
    }
    return true;
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
        console.error("Failed to fetch user:", error.message);
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
        console.error("Failed to insert pending update:", error.message);
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

export async function getUsersFriendInvitations(userId) {
    const result = new Array();
    const response = await db.all(`
        SELECT u1.nickname AS originator_nickname,
            u1.avatar AS originator_avatar,
            friends_with.originator AS originator_id
        FROM friends_with
        JOIN users u1 ON u1.user_id = friends_with.originator
        WHERE is_invite = true
        AND friends_with.friended = ?`, userId);
    response.forEach((row) => {
        const invite = new User(row.originator_nickname);
        invite.id = row.originator_id;
        invite.avatar = row.originator_avatar;
        result.push(invite);
    });
    return result;
}

export async function getUsersPendingFriendInvitations(userId) {
    const result = new Array();
    const response = await db.all(`
        SELECT u1.nickname AS friended_nickname,
            u1.avatar AS friended_avatar,
            friends_with.friended AS friended_id
        FROM friends_with
        JOIN users u1 ON u1.user_id = friends_with.friended
        WHERE is_invite = true
        AND friends_with.originator = ?`, userId);
    response.forEach((row) => {
        const invite = new User(row.friended_nickname);
        invite.id = row.friended_id;
        invite.avatar = row.friended_avatar;
        result.push(invite);
    });
    return result;
}

export async function getUsersFriends(userId) {
    const result = new Array();
    const response = await db.all(`
        SELECT u1.nickname AS friended_nickname,
            u2.nickname AS originator_nickname,
            u1.avatar AS friended_avatar,
            u2.avatar AS originator_avatar,
            friends_with.friended AS friended_id,
            friends_with.originator AS originator_id
        FROM friends_with
        JOIN users u1 ON u1.user_id = friends_with.friended
        JOIN users u2 ON u2.user_id = friends_with.originator
        WHERE is_invite = false
        AND (friends_with.originator = ? OR friends_with.friended = ?)`, userId, userId);
    response.forEach((row) => {
        if (row.friended_id === userId) {
            const invite = new User(row.originator_nickname);
            invite.id = row.originator_id;
            invite.avatar = row.originator_avatar;
            result.push(invite);
        } else if (row.originator_id === userId) {
            const invite = new User(row.friended_nickname);
            invite.id = row.friended_id;
            invite.avatar = row.friended_avatar;
            result.push(invite);
        }
    });
    return result;
}

export async function acceptPendingInvite(friendedId, originatorId) {
    await db.run("UPDATE friends_with SET is_invite = false WHERE is_invite = true AND friended = ? AND originator = ?", friendedId, originatorId);
}

export async function removePendingInvite(friendedId, originatorId) {
    await db.run("DELETE FROM friends_with WHERE is_invite = true AND friended = ? AND originator = ?", friendedId, originatorId);
}

export async function addFriendInvite(originatorId, friendedId) {
    if (originatorId === friendedId) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Cannot invite yourself");
    }
    if (!friendedId || !originatorId) {
        throw new HTTPError(StatusCodes.NOT_FOUND, "User not found");
    }
    if (await hasRecordInFriendsWithTable(originatorId, friendedId)) {
        throw new HTTPError(StatusCodes.BAD_REQUEST, "Already friends or invitation is pending");
    }
    await db.run("INSERT INTO friends_with (originator, friended, is_invite) VALUES (?, ?, ?)", originatorId, friendedId, true);
}

export async function removeFriend(userOneId, userTwoId) {
    await db.run(`
        DELETE FROM friends_with
        WHERE is_invite = false
        AND ((friended = ? AND originator = ?) OR (friended = ? AND originator = ?))`,
        userOneId, userTwoId, userTwoId, userOneId);
}

async function hasRecordInFriendsWithTable(userOneId, userTwoId) {
    const relationship = await db.get(`
        SELECT originator, friended
        FROM friends_with
        WHERE ((originator = ? AND friended = ?) OR (originator = ? AND friended = ?))`,
        userOneId, userTwoId, userTwoId, userOneId);
    if (!relationship || !relationship.originator || !relationship.friended) {
        return false;
    }
    return true;
}
