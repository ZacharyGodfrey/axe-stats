const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profiles.html`);

module.exports = async (db) => render(page, {
  title: 'IATF Profiles',
  profilesJSON: JSON.stringify(await db.query(`
    SELECT *
    FROM profiles
    WHERE premierRank > 0
    ORDER BY
      premierRank ASC,
      premierRating DESC,
      premierAverage DESC;
  `), null, 2)
});
