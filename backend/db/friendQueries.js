import { db } from "../server.js";
import HTTPError from "../utils/error.js";
import { StatusCodes } from "http-status-codes";
import User from "../utils/User.js";

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
 * Get the friend invitations sent TO the user
 * @param {number} userId the users id
 * @returns {Promise<Array<User>>} the array of users who sent a friend invitation
 */
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

/**
 * Get the friend invitations sent FROM the user
 * @param {number} userId the users id
 * @returns {Promise<Array<User>>} the array of users to whom this user sent a friend invitation
 */
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

/**
 * Get the friends of a user
 * @param {number} userId the users id
 * @returns {Promise<Array<User>>} the array of users who are friends with the user
 */
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

/**
 * Accept a pending invitation
 * @param {number} friendedId the id of a user to whom another user sent an invitation
 * @param {number} originatorId the id of a user who sent the invitation
 */
export async function acceptPendingInvite(friendedId, originatorId) {
    await db.run("UPDATE friends_with SET is_invite = false WHERE is_invite = true AND friended = ? AND originator = ?", friendedId, originatorId);
}

/**
 * Remove a pending invitation
 * @param {number} friendedId the id of a user to whom another user sent an invitation
 * @param {number} originatorId the id of a user who sent the invitation
 */
export async function removePendingInvite(friendedId, originatorId) {
    await db.run("DELETE FROM friends_with WHERE is_invite = true AND friended = ? AND originator = ?", friendedId, originatorId);
}

/**
 * Add a friend invitation
 * @param {number} originatorId the id of a user who sent the invitation
 * @param {number} friendedId the id of a user to whom another user sent an invitation
 * @throws {HTTPError} BAD_REQUEST if ids are the same or already invitation pending or already friends
 * @throws {HTTPError} NOT_FOUND if user not found
 */
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

/**
 * Remove a friend
 * @param {number} userOneId one of the users
 * @param {number} userTwoId the other user
 */
export async function removeFriend(userOneId, userTwoId) {
    await db.run(`
        DELETE FROM friends_with
        WHERE is_invite = false
        AND ((friended = ? AND originator = ?) OR (friended = ? AND originator = ?))`,
        userOneId, userTwoId, userTwoId, userOneId);
}

/**
 * Checks whether two users are friends or whether one of them already sent a friend invitation
 * @param {number} userOneId one of the users
 * @param {number} userTwoId the other user
 * @returns {Promise<boolean>} whether there is already a record in the friends_with table
 */
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
