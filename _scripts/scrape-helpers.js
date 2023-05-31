const db = require('../src/database');

export const ensureTables = async () => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,
      average REAL DEFAULT 0
    ) WITHOUT ROWID;
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY,
      processed INTEGER DEFAULT 0
    ) WITHOUT ROWID;
  `);
};

export const sequentially = async (items, action) => {
  return items.reduce((prev, item, index) => {
    return prev.then(() => action(item, index));
  }, Promise.resolve());
};

export const logErrorAndDefault = (defaultValue) => {
  return (error) => {
    console.error(error);

    return defaultValue;
  };
};
