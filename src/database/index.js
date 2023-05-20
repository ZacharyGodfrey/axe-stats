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

const insert = (table, entity) => {
  const keys = [], values = [], placeholders = [];

  Object.entries(entity).forEach(([key, value]) => {
    keys.push(key);
    values.push(value);
    placeholders.push('?');
  });

  return run(`
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders.join(', ')});
  `, values);
};

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
      rank INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      average REAL NOT NULL
    ) WITHOUT ROWID;
  `);
};

const timestamp = async () => {
  const sql = `SELECT * FROM timestamp;`;
  const [{ timestamp }] = await query(sql);

  return timestamp;
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
  run,
  query,
  get,
  insert,
  disconnect,
  ensureSchema,
  timestamp,
  allProfiles,
  getProfileById,
};