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
  }).then(ensureTables);
});

const ensureTables = async () => {
  console.log('Ensuring tables exist...');

  await run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,

      matchWin INTEGER DEFAULT 0,
      matchLoss INTEGER DEFAULT 0,
      matchOTL INTEGER DEFAULT 0,
      matchTotalScore INTEGER DEFAULT 0,

      hatchetRoundWin INTEGER DEFAULT 0,
      hatchetRoundLoss INTEGER DEFAULT 0,
      hatchetRoundTie INTEGER DEFAULT 0,
      hatchetTotalScore INTEGER DEFAULT 0,
      hatchetThrowCount INTEGER DEFAULT 0,

      hatchetClutchCall INTEGER DEFAULT 0,
      hatchetClutchHit INTEGER DEFAULT 0,

      hatchetFive INTEGER DEFAULT 0,
      hatchetThree INTEGER DEFAULT 0,
      hatchetOne INTEGER DEFAULT 0,
      hatchetDrop INTEGER DEFAULT 0,

      bigAxeRoundWin INTEGER DEFAULT 0,
      bigAxeRoundLoss INTEGER DEFAULT 0,
      bigAxeTotalScore INTEGER DEFAULT 0,
      bigAxeThrowCount INTEGER DEFAULT 0,

      bigAxeClutchCall INTEGER DEFAULT 0,
      bigAxeClutchHit INTEGER DEFAULT 0,

      bigAxeFive INTEGER DEFAULT 0,
      bigAxeThree INTEGER DEFAULT 0,
      bigAxeOne INTEGER DEFAULT 0,
      bigAxeDrop INTEGER DEFAULT 0

    ) WITHOUT ROWID;
  `);

  const { imageExists = 0 } = await get(`
    SELECT COUNT(*) AS imageExists
    FROM pragma_table_info('profiles')
    WHERE name = 'image';
  `);

  if (!imageExists) {
    console.log('Adding column "image" to table "profiles"');

    await run(`ALTER TABLE profiles ADD COLUMN image text;`);
  }

  await run(`
    CREATE TABLE IF NOT EXISTS matches (
      profileId INTEGER NOT NULL,
      id INTEGER NOT NULL,
      processed INTEGER DEFAULT 0,

      matchWin INTEGER DEFAULT 0,
      matchLoss INTEGER DEFAULT 0,
      matchOTL INTEGER DEFAULT 0,
      matchTotalScore INTEGER DEFAULT 0,

      hatchetRoundWin INTEGER DEFAULT 0,
      hatchetRoundLoss INTEGER DEFAULT 0,
      hatchetRoundTie INTEGER DEFAULT 0,

      hatchetClutchCall INTEGER DEFAULT 0,
      hatchetClutchHit INTEGER DEFAULT 0,

      hatchetFive INTEGER DEFAULT 0,
      hatchetThree INTEGER DEFAULT 0,
      hatchetOne INTEGER DEFAULT 0,
      hatchetDrop INTEGER DEFAULT 0,

      bigAxeRoundWin INTEGER DEFAULT 0,
      bigAxeRoundLoss INTEGER DEFAULT 0,

      bigAxeClutchCall INTEGER DEFAULT 0,
      bigAxeClutchHit INTEGER DEFAULT 0,

      bigAxeFive INTEGER DEFAULT 0,
      bigAxeThree INTEGER DEFAULT 0,
      bigAxeOne INTEGER DEFAULT 0,
      bigAxeDrop INTEGER DEFAULT 0,

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