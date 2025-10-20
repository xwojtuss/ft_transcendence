CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    nickname TEXT NOT NULL UNIQUE,
    is_online BOOLEAN DEFAULT true,
    password TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    avatar TEXT,
    phone_number TEXT,
    won_games INTEGER DEFAULT 0,
    lost_games INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tfas (
    user_id INTEGER PRIMARY KEY,
    type VARCHAR(10) NOT NULL,
    encrypted_secret TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS pending_updates (
    user_id INTEGER PRIMARY KEY,
    nickname TEXT,
    password TEXT,
    email TEXT,
    avatar TEXT,
    phone_number TEXT,
    tfa_type VARCHAR(10),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS pending_tfas (
    user_id INTEGER PRIMARY KEY,
    type VARCHAR(10) NOT NULL,
    encrypted_secret TEXT,
    iv TEXT,
    tag TEXT,
    expires_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
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
    game TEXT NOT NULL,
    mode TEXT NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    num_of_players INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
    match_id INTEGER NOT NULL REFERENCES match_history(match_id),
    participant_id INTEGER PRIMARY KEY,
    user_account INTEGER DEFAULT NULL,
    alias TEXT DEFAULT NULL,
    is_originator BOOLEAN NOT NULL,
    is_logged_in BOOLEAN NOT NULL DEFAULT false,
    outcome TEXT NOT NULL,
    FOREIGN KEY (user_account) REFERENCES users(user_id)
);

CREATE TRIGGER IF NOT EXISTS increment_won_games
AFTER INSERT ON participants
FOR EACH ROW
WHEN NEW.outcome = "Won"
BEGIN
    UPDATE users
    SET won_games = won_games + 1
    WHERE user_id = NEW.user_account;
END;

CREATE TRIGGER IF NOT EXISTS decrement_won_games
AFTER DELETE ON participants
FOR EACH ROW
WHEN OLD.outcome = "Won"
BEGIN
    UPDATE users
    SET won_games = won_games - 1
    WHERE user_id = OLD.user_account;
END;

-- CREATE TRIGGER IF NOT EXISTS increment_lost_games
-- AFTER INSERT ON participants
-- FOR EACH ROW
-- WHEN NEW.outcome != "Won"
-- BEGIN
--     UPDATE users
--     SET lost_games = lost_games + 1
--     WHERE user_id = NEW.user_account;
-- END;

-- CREATE TRIGGER IF NOT EXISTS decrement_lost_games
-- AFTER DELETE ON participants
-- FOR EACH ROW
-- WHEN OLD.outcome != "Won"
-- BEGIN
--     UPDATE users
--     SET lost_games = lost_games - 1
--     WHERE user_id = OLD.user_account;
-- END;

CREATE TRIGGER IF NOT EXISTS increment_lost_games
AFTER INSERT ON participants
FOR EACH ROW
WHEN NEW.outcome = "Lost"
BEGIN
  UPDATE users SET lost_games = lost_games + 1 WHERE user_id = NEW.user_account;
END;

CREATE TRIGGER IF NOT EXISTS decrement_lost_games
AFTER DELETE ON participants
FOR EACH ROW
WHEN OLD.outcome = "Lost"
BEGIN
  UPDATE users SET lost_games = lost_games - 1 WHERE user_id = OLD.user_account;
END;



-- ^^^^^ TRDM ^^^^^
-- Tournament tables for local-tournament feature
CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id INTEGER PRIMARY KEY,
    num_players   INTEGER NOT NULL,
    user_id       INTEGER REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS tournament_players (
    player_id     INTEGER PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(tournament_id),
    alias         TEXT    NOT NULL,
    is_logged_user BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    match_id      INTEGER PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(tournament_id),
    round         INTEGER NOT NULL,
    is_third      BOOLEAN NOT NULL DEFAULT 0,
    player1_id    INTEGER REFERENCES tournament_players(player_id),
    player2_id    INTEGER REFERENCES tournament_players(player_id),
    winner_id     INTEGER REFERENCES tournament_players(player_id)
);
