const db = require('../src/database');

const ensureSchema = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS timestamp (
      id INTEGER PRIMARY KEY,
      timestamp TEXT NOT NULL UNIQUE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      urlId TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      standardRating INTEGER DEFAULT 0,
      premierRating INTEGER DEFAULT 0
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY,
      profileId INTEGER NOT NULL,
      urlId TEXT NOT NULL,
      name TEXT NOT NULL,
      ruleset TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles (id) ON DELETE CASCADE ON UPDATE NO ACTION
    );
  `);
};

const seedTables = async (db) => {
  const now = new Date().toISOString();

  const me = [
    '1207260',
    'REDACTED',
    1509,
    1621
  ];

  const seasons = [
    [
      '267739',
      'Axe Champs Tuesday Purple 2023 Spring premier',
      'Premier',
      '2023-01-11'
    ],
    [
      '251574',
      'Valhalla Fleming Island Saturday Yellow 2022 NYE Marathon League',
      'Premier',
      '2022-12-31'
    ]
  ];

  await db.query(`INSERT INTO timestamp (timestamp) VALUES(?);`, [now]);

  const [profile] = await db.query(`
    INSERT INTO profiles (urlId, name, standardRating, premierRating)
    VALUES (?, ?, ?, ?) RETURNING *;
  `, me);

  await Promise.all(seasons.map(season => db.query(`
    INSERT INTO seasons (profileId, urlId, name, ruleset, date)
    VALUES (?, ?, ?, ?, ?);
  `, [profile.id, ...season])));
};

(async () => {
  try {
    console.log('Deleting database file before connecting...');

    fs.removeSync(db._fileName);

    console.log(`Deleted: ${db._fileName}`);

    await ensureSchema(db);
    await seedTables(db);
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();