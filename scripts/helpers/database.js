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

const connect = () => connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection = new sqlite3.Database(FILE_NAME, (error) => {
    if (error) {
      reject(error);
    } else {
      console.log('Connected to the databse');

      resolve();
    }
  });
}).then(ensureTables);

const ensureTables = async () => {
  console.log('Ensuring tables exist...');

  await run(`
    CREATE TABLE IF NOT EXISTS profiles (
      profileId INTEGER PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '',
      rank INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      stats TEXT NOT NULL DEFAULT ''
    ) WITHOUT ROWID;
  `);

  const matchStates = Object.values(enums.matchState).join(', ');

  await run(`
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
};

const run = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  connection.run(sql, params, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
}));

const query = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  connection.all(sql, params, (error, rows) => {
    if (error) {
      reject(error);
    } else {
      resolve(rows);
    }
  });
}));

const get = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  connection.get(sql, params, (error, row) => {
    if (error) {
      reject(error);
    } else {
      resolve(row);
    }
  });
}));

const disconnect = () => !connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection.close((error) => {
    if (error) {
      reject(error);
    } else {
      connection = null;

      console.log('Disconnected from the database');

      resolve();
    }
  });
});

module.exports = {
  _fileName: FILE_NAME,
  connect,
  ensureTables,
  run,
  query,
  get,
  disconnect,
  enums
};