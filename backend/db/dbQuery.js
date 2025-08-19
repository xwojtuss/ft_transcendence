import { db } from "../server.js";
import User from "../utils/User.js";
import Match from "../utils/Match.js";

export default async function getAllUsers() {
    try {
        const users = await db.all("SELECT * FROM users");
        return users;
    } catch (error) {
        console.error("Failed to fetch users:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getUser(nickname) {
    try {
        const user = await db.get("SELECT * FROM users WHERE nickname=? LIMIT 1", nickname);
        if (!user || user.empty)
            return null;
        const userInstance = new User(user.nickname, user.password);
        userInstance.email = user.email;
        userInstance.isOnline = user.is_online;
        userInstance.avatar = user.avatar;
        userInstance.won_games = user.won_games;
        userInstance.lost_games = user.lost_games;
        return userInstance;
    } catch (error) {
        console.error("Failed to fetch user:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getUserByEmail(email) {
    try {
        const user = await db.get("SELECT * FROM users WHERE email=? LIMIT 1", email);
        if (!user || user.empty)
            return null;
        const userInstance = new User(user.nickname, user.password);
        userInstance.email = user.email;
        userInstance.isOnline = user.is_online;
        userInstance.avatar = user.avatar;
        userInstance.won_games = user.won_games;
        userInstance.lost_games = user.lost_games;
        return userInstance;
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

export async function addUser(user) {
    try {
        await db.run(
            "INSERT INTO users (nickname, password, email) VALUES (?, ?, ?)",
            user.nickname,
            user.password,
            user.email
        );
    } catch (error) {
        console.error("Failed to insert user:", error.message);
        throw new Error("Insert failed");
    }
}

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
    if (relationship === undefined) {
        return false;
    }
    return true;
}

export async function updateUser(originalUser, updatedUser) {
    await db.get(`
        UPDATE users
        SET nickname = ?, password = ?, email = ?
        WHERE nickname = ? AND email = ?`,
        updatedUser.nickname, updatedUser.password, updatedUser.email, originalUser.nickname, originalUser.email
    );
}