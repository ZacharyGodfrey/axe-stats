const db = require('../src/database');

try {
  db.connect();

  db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      urlId TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      standardRating INTEGER DEFAULT 0,
      premierRating INTEGER DEFAULT 0
    ) WITHOUT ROWID;
  `);

  db.query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY,
      profileId INTEGER NOT NULL,
      urlId TEXT NOT NULL,
      name TEXT NOT NULL,
      ruleset TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles (id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) WITHOUT ROWID;
  `);

  const me = [ '1207260', 'REDACTED', 1509, 1621 ];

  const meRow = db.query(`
    INSERT INTO profiles (urlId, name, standardRating, premierRating)
    VALUES (?, ?, ?, ?)
    RETURNING *;
  `, me)[0];

  const seasons = [
    [ '267739', 'Axe Champs Tuesday Purple 2023 Spring premier', 'Premier', '2023-01-11' ],
    [ '251574', 'Valhalla Fleming Island Saturday Yellow 2022 NYE Marathon League', 'Premier', '2022-12-31' ]
  ].map(x => [meRow.id].concat(x));

  seasons.forEach(season => {
    db.query(`
      INSERT INTO seasons (profileId, urlId, name, ruleset, date)
      VALUES (?, ?, ?, ?, ?);
    `, season);
  });
} catch (error) {
  console.log(error);
} finally {
  db.disconnect();
}