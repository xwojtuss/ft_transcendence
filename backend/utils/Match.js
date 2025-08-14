export default class Match {
    _participants = new Map();// map of users with their score for the tournament
    _endedAt;
    _originator;
    _numOfPlayers = 0;
    _maxNumOfPlayers = -1;

    /**
     * Create a match
     * @param {string | User} originator The person who created the match
     * @param {number | null} maxNumOfPlayers null if we don't limit the number of players, otherwise the max num of players
     * @throws {Error} originator is not defined or when maxNumOfPlayers is less than 2
     */
    constructor(originator, maxNumOfPlayers) {
        if (!originator)
            throw new Error("Originator must exist");
        if (maxNumOfPlayers && maxNumOfPlayers < 2)
            throw new Error("The number of players must be greater than 1");
        this._originator = originator;
        if (maxNumOfPlayers)
            this._maxNumOfPlayers = maxNumOfPlayers;
        else
            this._maxNumOfPlayers = -1;
        this.addParticipant(originator);
    }

    get originator() {
        return this._originator;
    }

    /**
     * Add participants before we end the match
     * @param {string | User} user The user to add
     * @throws {Error} When user is not defined or when there's too many players
     */
    addParticipant(user) {
        if (!user)
            throw new Error("User must exist");
        if (this._maxNumOfPlayers !== -1 && this._numOfPlayers >= this._maxNumOfPlayers)
            throw new Error("Too many players");
        this._participants.set(user, 0);
        this._numOfPlayers++;
    }

    /**
     * Add participants before we end the match
     * @param {string | User} user The user to add
     * @throws {Error} when the match has ended or when the user is not defined
     */
    removeParticipant(user) {
        if (this._endedAt)
            throw new Error("Match has ended");
        if (!user)
            throw new Error("User must exist");
        this._participants.delete(user);
        this._numOfPlayers--;
    }

    /**
     * Set the rank of a user
     * @param {string | User} user The user which rank to set
     * @param {number} rank The rank of the user, 1 being the highest
     */
    addRank(user, rank) {
        if (rank < 1 || (this._maxNumOfPlayers !== -1 && rank > this._maxNumOfPlayers))
            throw new Error("Rank is invalid");
        this._participants.set(user, rank);
    }

    /**
     * End the match, set the EndedAt timestamp
     */
    endMatch() {
        this._endedAt = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    // only for reassembling data from database
    set endedAt(endedAt) {
        this._endedAt = endedAt;
    }

    get participants() {
        return this._participants;
    }

    get numOfPlayers() {
        return this._numOfPlayers;
    }

    get maxNumOfPlayers() {
        return this._maxNumOfPlayers;
    }

    get endedAt() {
        return this._endedAt;
    }

    /**
     * Get the rank of a user
     * @param {string | User} participant The user whose rank to get
     * @returns 
     */
    getRank(participant) {
        return this._participants.get(participant);
    }
}