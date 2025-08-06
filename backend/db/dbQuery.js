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

export async function getAllMatchHistory() {
    try {
        const matches = await db.all("SELECT * FROM match_history");
        return matches;
    } catch (error) {
        console.error("Failed to fetch match history:", error.message);
        throw new Error("Database query failed");
    }
}

/*
<th>Date</th>
<th>Player Count</th>
<th>Opponents</th>
<th>Initiator</th>
<th>Rank</th>

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL UNIQUE,
    is_online BOOLEAN DEFAULT true,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar TEXT,
    won_games INTEGER DEFAULT 0,
    lost_games INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS match_history (
    match_id INTEGER PRIMARY KEY,
    ended_at TIMESTAMP NOT NULL,
    num_of_players INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
    match_id INTEGER NOT NULL REFERENCES match_history(match_id),
    participant INTEGER NOT NULL REFERENCES users(user_id),
    is_originator BOOLEAN NOT NULL,
    rank INTEGER NOT NULL,
    PRIMARY KEY (match_id, participant)
);
*/
export async function getUserMatchHistory(nickname) {
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
            ORDER BY matches.is_originator DESC;`, nickname);
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
