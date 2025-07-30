export default class Match {
    _participants = new Map();// map of users with their score for the tournament
    _endedAt;
    _originator;
    _numOfPlayers = 0;
    _maxNumOfPlayers = -1;

    // maxNumOfPlayers can be null, then we don't limit the number of players
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

    // before the scores are known
    addParticipant(user) {
        if (this._endedAt)
            throw new Error("Match has ended");
        if (!user)
            throw new Error("User must exist");
        if (this._maxNumOfPlayers !== -1 && this._numOfPlayers >= this._maxNumOfPlayers)
            throw new Error("Too many players");
        this._participants.set(user, 0);
        this._numOfPlayers++;
    }

    removeParticipant(user) {
        if (this._endedAt)
            throw new Error("Match has ended");
        if (!user)
            throw new Error("User must exist");
        this._participants.delete(user);
        this._numOfPlayers--;
    }

    // after the scores are known
    addRank(user, rank) {
        if (rank < 1 || rank > this._numOfPlayers)
            throw new Error("Rank is invalid");
        this._participants.set(user, rank);
    }

    endMatch() {
        this._endedAt = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    }

    get participants() {
        return this._participants;
    }

    get numOfPlayers() {
        return this._numOfPlayers;
    }

    get endedAt() {
        return this._endedAt;
    }
}