const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const updatedAt = await db.timestamp();
  const allProfiles = await db.query(`
    SELECT *
    FROM profiles
    WHERE premierRank > 0
    ORDER BY
      premierRank ASC,
      premierAverage DESC,
      standardRank ASC,
      standardAverage DESC
    LIMIT 256;
  `);

  return render(page, { allProfiles, updatedAt });
};