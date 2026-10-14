-- Dialect: SQLite 3.25+ (window functions). Portable notes for MySQL/Postgres are in sql/README.md.

-- ---------- Scenario 1: payments ----------
CREATE TABLE transactions (
    txn_id        INTEGER PRIMARY KEY,
    from_account  TEXT    NOT NULL,
    to_account    TEXT    NOT NULL,
    amount        NUMERIC NOT NULL CHECK (amount > 0),
    txn_time      TEXT    NOT NULL,            -- ISO-8601 'YYYY-MM-DD HH:MM:SS'
    CHECK (from_account <> to_account)
);
CREATE INDEX idx_txn_pair_time ON transactions (from_account, to_account, txn_time);

-- ---------- Scenario 2: IPL 2024 ----------
CREATE TABLE ipl_matches (
    match_id    INTEGER PRIMARY KEY,
    season      INTEGER NOT NULL,
    match_date  TEXT    NOT NULL                -- 'YYYY-MM-DD'
);

CREATE TABLE batting_scores (
    match_id     INTEGER NOT NULL REFERENCES ipl_matches (match_id),
    player_name  TEXT    NOT NULL,
    team         TEXT    NOT NULL,
    runs         INTEGER,                       -- NULL = did not bat
    PRIMARY KEY (match_id, player_name)
);
CREATE INDEX idx_batting_player ON batting_scores (player_name, match_id);
