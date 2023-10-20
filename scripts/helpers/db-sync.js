const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/../../database.db`;
let connection = null;

const enums = {
  matchState: {
    unprocessed: 0,
    invalid: 1,
    forfeit: 2,
    valid: 3
  }
};

const connect = () => {
  if (connection) {
    return connection;
  }

  console.log('Connecting to the database');

  connection = new sqlite3.Database(FILE_NAME, (error) => {
    if (error) {
      throw error;
    }
  });

  console.log('Ensuring tables exist');

  const matchStates = Object.values(enums.matchState).join(', ');

  run(`
    CREATE TABLE IF NOT EXISTS profiles (
      profileId INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      stats TEXT NOT NULL DEFAULT ''
    ) WITHOUT ROWID;
  `);

  run(`
    CREATE TABLE IF NOT EXISTS matches (
      matchId INTEGER NOT NULL,
      profileId INTEGER NOT NULL,
      state INTEGER CHECK(state IN (${matchStates})) NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT '',
      total INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL DEFAULT '',
      stats TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (matchId, profileId)
    ) WITHOUT ROWID;
  `);

  return connection;
};

const run = (sql, params = []) => {
  connect().run(sql, params, (error) => {
    if (error) {
      throw error
    }
  });
};

const one = (sql, params = []) => {
  let result = {};

  connect().get(sql, params, (error, row) => {
    if (error) {
      throw error;
    } else {
      result = row;
    }
  });

  return result;
};

const all = (sql, params = []) => {
  let result = [];

  connect().all(sql, params, (error, rows) => {
    if (error) {
      throw error;
    } else {
      result = rows;
    }
  });

  return result;
};

module.exports = {
  _fileName: FILE_NAME,
  enums,
  run,
  one,
  all
};