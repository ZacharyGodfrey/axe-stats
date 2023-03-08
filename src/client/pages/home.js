const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  return render(page, {
    updatedAt: await db.timestamp(),
    totalProfiles = JSON.stringify(await db.get(`SELECT COUNT(*) count FROM profiles;`)),
    standard: {
      average: (await db.get(`
        SELECT ROUND(AVG(standardAverage), 3) average
        FROM profiles
        WHERE standardAverage > 0;
      `))['average'],
      top256: await db.query(`
        SELECT *
        FROM profiles
        WHERE standardRank > 0
        ORDER BY standardRank ASC, standardAverage DESC
        LIMIT 256;
      `)
    },
    premier: {
      average: (await db.get(`
        SELECT ROUND(AVG(premierAverage), 3) average
        FROM profiles
        WHERE premierAverage > 0;
      `))['average'],
      top256: await db.query(`
        SELECT *
        FROM profiles
        WHERE premierRank > 0
        ORDER BY premierRank ASC, premierAverage DESC
        LIMIT 256;
      `)
    }
  });
};
