const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/data.db`;
let connection = null;

const connect = () => connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection = new sqlite3.Database(FILE_NAME, (error) => {
    if (error) {
      reject(error);
    } else {
      console.log('[DATABASE] Connected to the databse.');

      resolve();
    }
  });
});

const query = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  connection.all(sql, params, (error, rows) => {
    if (error) {
      reject(error);
    } else {
      resolve(rows);
    }
  });
}));

const disconnect = () => !connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection.close((error) => {
    if (error) {
      reject(error);
    } else {
      connection = null;

      console.log('[DATABASE] Disconnected from the database.');

      resolve();
    }
  });
});

const ensureSchema = async () => {
  console.log('[DATABASE] Ensure Schema');

  await query(`
    CREATE TABLE IF NOT EXISTS timestamp (
      id INTEGER PRIMARY KEY,
      timestamp TEXT NOT NULL UNIQUE
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      standardRank INTEGER NOT NULL,
      standardRating INTEGER NOT NULL,
      premierRank INTEGER NOT NULL,
      premierRating INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY,
      profileId INTEGER NOT NULL,
      name TEXT NOT NULL,
      ruleset TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles (id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) WITHOUT ROWID;
  `);
};

const timestamp = async () => {
  const sql = `SELECT * FROM timestamp;`;
  const [row] = await query(sql);

  return row.timestamp;
};

const allProfiles = async () => {
  const sql = `SELECT * FROM profiles ORDER BY name ASC;`;
  const rows = await query(sql);

  return rows;
};

const getProfileById = async (id) => {
  const sql = `SELECT * FROM profiles WHERE urlId = ?;`;
  const [profile] = await query(sql, [id]);

  return profile || null;
};

module.exports = {
  _fileName: FILE_NAME,
  connect,
  query,
  disconnect,
  ensureSchema,
  timestamp,
  allProfiles,
  getProfileById,
};