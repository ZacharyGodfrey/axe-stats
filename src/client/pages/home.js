const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const updatedAt = await db.timestamp();
  const allProfiles = await db.query(`
    SELECT *
    FROM profiles
    WHERE name LIKE '%REDACTED%';
  `);

  return render(page, { allProfiles, updatedAt });
};