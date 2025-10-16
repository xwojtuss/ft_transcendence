import { db } from "../buildApp.js";
import User from "./User.js";

export default class Match {
    /**
     * Map of users with their corresponding tournament score,
     * Rank 1 is the highest
     */
    #participants = new Map();// 
    #endedAt;
    #originator;
    #numOfPlayers = 0;
    #maxNumOfPlayers = -1;
    #mode;
    #game;

    /**
     * Create a match
     * @param {string | User} originator The person who created the match
     * @param {string} game The name of the game
     * @param {string} mode The mode of the game
     * @param {number | null | undefined} [maxNumOfPlayers] the maximum number of players, if there's no limit - null
     * @throws {Error} originator is not defined or when maxNumOfPlayers is less than 2
     */
    constructor(originator, game, mode, maxNumOfPlayers) {
        if (!originator)
            throw new Error("Originator must exist");
        if (maxNumOfPlayers && maxNumOfPlayers < 2)
            throw new Error("The number of players must be greater than 1");
        this.#originator = originator;
        this.#game = game;
        this.#mode = mode;
        if (maxNumOfPlayers)
            this.#maxNumOfPlayers = maxNumOfPlayers;
        else
            this.#maxNumOfPlayers = -1;
        this.addParticipant(originator);
    }

    get originator() {
        return this.#originator;
    }

    /**
     * Add participants before we end the match
     * @param {string | User} user The user to add or alias
     * @throws {Error} When user is not defined or when there's too many players
     */
    addParticipant(user) {
        if (!user)
            throw new Error("User must exist");
        if (this.#maxNumOfPlayers !== -1 && this.#numOfPlayers >= this.#maxNumOfPlayers)
            throw new Error("Too many players");
        this.#participants.set(user, "");
        this.#numOfPlayers++;
    }

    /**
     * Remove a participant before the match ends
     * @param {string | User} user The user to remove or alias
     * @throws {Error} when the match has ended or when the user is not defined
     */
    removeParticipant(user) {
        if (this.#endedAt)
            throw new Error("Match has ended");
        if (!user)
            throw new Error("User must exist");
        this.#participants.delete(user);
        this.#numOfPlayers--;
    }

    /**
     * Set the rank of a user
     * @param {string | User} user The user which rank to set
     * @param {"Won" | "Lost"} outcome The outcome for the user
     */
    addRank(user, outcome) {
        const possibleOutcomes = ["Won", "Lost"]
        if (!possibleOutcomes.includes(outcome))
            throw new Error("Rank is invalid");
        this.#participants.set(user, outcome);
    }

    /**
     * End the match, set the EndedAt timestamp
     */
    endMatch() {
        this.#endedAt = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    /**
     * Commit the match to the database, the user must have nickname and id assigned
     * @throws {Error} when the match has not been ended or on query error, rollsback on error
     */
    async commitMatch() {
        if (!this.#endedAt) throw new Error("Match did not end");
        await db.exec("BEGIN TRANSACTION");
        try {
            const result = await db.run(
                "INSERT INTO match_history (ended_at, num_of_players, game, mode) VALUES (?, ?, ?, ?)",
                this.#endedAt,
                this.#numOfPlayers,
                this.#game,
                this.#mode
            );
            const matchID = result.lastID;
            for (const [player, outcome] of this.#participants.entries()) {
                await db.run(
                    "INSERT INTO participants (match_id, user_account, alias, is_originator, is_logged_in, outcome) VALUES (?, ?, ?, ?, ?, ?)",
                    matchID,
                    player instanceof User ? player.id : null,
                    typeof player === "string" ? player : null,
                    (this.#originator === player),
                    player instanceof User ? true : false,
                    outcome
                );
            }
            await db.exec("COMMIT");
        } catch (error) {
            await db.exec("ROLLBACK");
            throw new Error("Insert failed");
        }
    }

    /**
     * This is only for recreating the Match from the database data
     */
    set endedAt(endedAt) {
        this.#endedAt = endedAt;
    }

    get participants() {
        return this.#participants;
    }

    get numOfPlayers() {
        return this.#numOfPlayers;
    }

    get maxNumOfPlayers() {
        return this.#maxNumOfPlayers;
    }

    get endedAt() {
        return this.#endedAt;
    }

    get game() {
        return this.#game;
    }

    set game(gameType) {
        this.#game = gameType;
    }

    get mode() {
        return this.#mode;
    }

    set mode(gameMode) {
        this.#mode = gameMode;
    }

    /**
     * Get the rank of a user
     * @param {string | User} participant The user whose rank to get
     * @returns {string | undefined} The outcome for the participant, or undefined if not found.
     */
    getRank(participant) {
        return this.#participants.get(participant);
    }

    /**
     * Get the match history of a user (by nickname or alias)
     * @param {string | User} user The user nickname or User
     * @returns {Promise<Map<number, Match>>} A map of [match.match_id, Match]
     * @throws {Error} if query failed
     */
    static async getUserMatches(user) {
        const matchesMap = new Map();
        const identifier = typeof user === "string" ? user : user.nickname;

        try {
            const matches = await db.all(`
                SELECT 
                    mh.match_id,
                    mh.game,
                    mh.mode,
                    mh.ended_at,
                    mh.num_of_players,
                    p.is_originator,
                    p.is_logged_in,
                    p.alias,
                    p.user_account,
                    p.outcome,
                    u.nickname
                FROM match_history mh
                JOIN participants p ON p.match_id = mh.match_id
                LEFT JOIN users u ON u.user_id = p.user_account
                WHERE mh.match_id IN (
                    SELECT p2.match_id
                    FROM participants p2
                    LEFT JOIN users u2 ON u2.user_id = p2.user_account
                    WHERE (u2.nickname = ? OR p2.alias = ?)
                )
                ORDER BY p.is_originator DESC;
            `, [identifier, identifier]);
            if (matches.length === 0) return new Map();
            const originator = matches[0].is_logged_in ? new User(matches[0].nickname) : matches[0].alias;
            const matchInstance = new Match(originator, matches[0].game, matches[0].mode, matches[0].num_of_players);
            matchInstance.mode = matches[0].mode;
            matchInstance.game = matches[0].game;
            matchInstance.endedAt = matches[0].ended_at;
            matchInstance.addRank(originator, (matches[0].outcome));
            matchesMap.set(matches[0].match_id, matchInstance);
            for (const match of matches) {
                if ((match.is_logged_in && match.nickname === originator.nickname)
                    || (!match.is_logged_in && match.alias === originator)) continue;

                if (match.is_logged_in) {
                    const participant = new User(match.nickname);
                    participant.id = match.user_account;
                    matchInstance.addParticipant(participant);
                    matchInstance.addRank(participant, match.outcome);
                } else {
                    matchInstance.addParticipant(match.alias);
                    matchInstance.addRank(match.alias, match.outcome)
                }
            }
            return matchesMap;
        } catch (error) {
            console.error(error);
            throw new Error("Database query failed");
        }
    }
}