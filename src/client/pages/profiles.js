const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profiles.html`);

module.exports = async (db) => render(page, {
  title: 'IATF Profiles',
  profilesJSON: JSON.stringify(await db.query(`
    SELECT *
    FROM profiles
    WHERE rank > 0
    ORDER BY rank ASC, rating DESC, average DESC;
  `), null, 2)
});
