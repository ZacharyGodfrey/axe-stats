const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/standard-list.html`);

module.exports = async (db) => render(page, {
  title: 'Standard Throwers',
  profilesJSON: JSON.stringify(await db.query(`
    SELECT *
    FROM profiles
    WHERE standardRank > 0
    ORDER BY
      standardRank ASC,
      standardRating DESC,
      standardAverage DESC;
  `), null, 2)
});
