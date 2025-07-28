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

CREATE TABLE IF NOT EXISTS friends_with (
    originator INTEGER NOT NULL,
    friended INTEGER NOT NULL,
    is_invite BOOLEAN NOT NULL,
    FOREIGN KEY (originator) REFERENCES users(user_id),
    FOREIGN KEY (friended) REFERENCES users(user_id),
    PRIMARY KEY (originator, friended)
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

CREATE TRIGGER IF NOT EXISTS increment_won_games
AFTER INSERT ON matches
FOR EACH ROW
WHEN NEW.rank = 1
BEGIN
    UPDATE users
    SET won_games = won_games + 1
    WHERE user_id = NEW.participant;
END;

CREATE TRIGGER IF NOT EXISTS decrement_won_games
AFTER DELETE ON matches
FOR EACH ROW
WHEN OLD.rank = 1
BEGIN
    UPDATE users
    SET won_games = won_games - 1
    WHERE user_id = OLD.participant;
END;

CREATE TRIGGER IF NOT EXISTS increment_lost_games
AFTER INSERT ON matches
FOR EACH ROW
WHEN NEW.rank != 1
BEGIN
    UPDATE users
    SET lost_games = lost_games + 1
    WHERE user_id = NEW.participant;
END;

CREATE TRIGGER IF NOT EXISTS decrement_lost_games
AFTER DELETE ON matches
FOR EACH ROW
WHEN OLD.rank != 1
BEGIN
    UPDATE users
    SET lost_games = lost_games - 1
    WHERE user_id = OLD.participant;
END;