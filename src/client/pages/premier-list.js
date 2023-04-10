const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/premier-list.html`);

module.exports = async (db) => render(page, {
  title: 'IATF Premier Profiles',
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
