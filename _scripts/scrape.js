const db = require('../src/database')({ destroyFileFirst: true });

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS timestamp (
        id INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL UNIQUE
      );
    `);

    await db.query(`INSERT INTO timestamp (timestamp) VALUES(?);`, [
      new Date().toISOString()
    ]);

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

    const me = [ '1207260', 'REDACTED', 1509, 1621 ];

    const [meRow] = await db.query(`
      INSERT INTO profiles (urlId, name, standardRating, premierRating)
      VALUES (?, ?, ?, ?)
      RETURNING *;
    `, me);

    const seasons = [
      [ '267739', 'Axe Champs Tuesday Purple 2023 Spring premier', 'Premier', '2023-01-11' ],
      [ '251574', 'Valhalla Fleming Island Saturday Yellow 2022 NYE Marathon League', 'Premier', '2022-12-31' ]
    ].map(x => [meRow.id].concat(x));

    await Promise.all(seasons.map(season => db.query(`
      INSERT INTO seasons (profileId, urlId, name, ruleset, date)
      VALUES (?, ?, ?, ?, ?);
    `, season)));
  } catch (error) {
    console.log(error);
  } finally {
    await db.disconnect();
  }
})();