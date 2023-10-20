const sqlite = require('better-sqlite3');

const db = new sqlite(`${__dirname}/../../database.db`, {});

const enums = {
  matchState: {
    unprocessed: 0,
    invalid: 1,
    forfeit: 2,
    valid: 3
  }
};

db.prepare(`
  CREATE TABLE IF NOT EXISTS profiles (
    profileId INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    about TEXT DEFAULT '',
    rank INTEGER NOT NULL DEFAULT 0,
    rating INTEGER NOT NULL DEFAULT 0,
    image TEXT NOT NULL DEFAULT ''
  ) WITHOUT ROWID;
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS matches (
    matchId INTEGER NOT NULL,
    profileId INTEGER NOT NULL,
    state INTEGER CHECK(state IN (${Object.values(enums.matchState).join(', ')})) NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL DEFAULT '',
    total INTEGER NOT NULL DEFAULT 0,
    rounds TEXT NOT NULL DEFAULT '[]'
    PRIMARY KEY (matchId, profileId)
  ) WITHOUT ROWID;
`).run();

module.exports = {
  enums,
  run: (sql, params = []) => db.prepare(sql).run(params),
  row: (sql, params = []) => db.prepare(sql).get(params),
  rows: (sql, params = []) => db.prepare(sql).all(params)
};