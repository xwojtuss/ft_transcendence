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

    /**
     * Create a match
     * @param {string | User} originator The person who created the match
     * @param {number | null | undefined} [maxNumOfPlayers] the maximum number of players, if there's no limit - null
     * @throws {Error} originator is not defined or when maxNumOfPlayers is less than 2
     */
    constructor(originator, maxNumOfPlayers) {
        if (!originator)
            throw new Error("Originator must exist");
        if (maxNumOfPlayers && maxNumOfPlayers < 2)
            throw new Error("The number of players must be greater than 1");
        this.#originator = originator;
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
     * @param {string | User} user The user to add
     * @throws {Error} When user is not defined or when there's too many players
     */
    addParticipant(user) {
        if (!user)
            throw new Error("User must exist");
        if (this.#maxNumOfPlayers !== -1 && this.#numOfPlayers >= this.#maxNumOfPlayers)
            throw new Error("Too many players");
        this.#participants.set(user, 0);
        this.#numOfPlayers++;
    }

    /**
     * Remove a participant before the match ends
     * @param {string | User} user The user to remove
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
     * @param {number} rank The rank of the user, 1 being the highest
     */
    addRank(user, rank) {
        if (rank < 1 || (this.#maxNumOfPlayers !== -1 && rank > this.#maxNumOfPlayers))
            throw new Error("Rank is invalid");
        this.#participants.set(user, rank);
    }

    /**
     * End the match, set the EndedAt timestamp
     */
    endMatch() {
        this.#endedAt = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
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

    /**
     * Get the rank of a user
     * @param {string | User} participant The user whose rank to get
     * @returns {number|undefined} The rank of the participant, or undefined if not found.
     */
    getRank(participant) {
        return this.#participants.get(participant);
    }
}