const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/../../database.db`;
let connection = null;

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
      id INTEGER PRIMARY KEY,
      name TEXT DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      image TEXT DEFAULT '',
      stats TEXT DEFAULT ''
    ) WITHOUT ROWID;
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS matches (
      profileId INTEGER NOT NULL,
      id INTEGER NOT NULL,
      processed INTEGER DEFAULT 0,
      valid INTEGER DEFAULT 0,
      text TEXT DEFAULT '',
      stats TEXT DEFAULT '{}',
      PRIMARY KEY (profileId, id)
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
  disconnect
};