export default async function getAllUsers(db) {
    try {
        const users = await db.all("SELECT * FROM users");
        return users;
    } catch (error) {
        console.error("Failed to fetch users:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getAllMatchHistory(db) {
    try {
        const matches = await db.all("SELECT * FROM match_history");
        return matches;
    } catch (error) {
        console.error("Failed to fetch match history:", error.message);
        throw new Error("Database query failed");
    }
}

export async function getAllMatches(db) {
    try {
        const matches = await db.all("SELECT * FROM matches");
        return matches;
    } catch (error) {
        console.error("Failed to fetch matches:", error.message);
        throw new Error("Database query failed");
    }
}

export async function addUser(db, user) {
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

export async function addMatch(db, match) {
    await db.exec("BEGIN TRANSACTION");
    try {
        const result = await db.run(
            "INSERT INTO match_history (ended_at, num_of_players) VALUES (?, ?)",
            match.endedAt,
            match.numOfPlayers
        );
        const matchID = result.lastID;
        for (var [player, rank] of match.participants.entries()) {
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
