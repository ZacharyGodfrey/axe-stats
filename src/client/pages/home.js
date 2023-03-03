const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const updatedAt = await db.timestamp();
  const allProfiles = await db.query(`
    SELECT *
    FROM profiles
    ORDER BY
      premierRating DESC,
      standardRating DESC;
  `);

  return render(page, { allProfiles, updatedAt });
};