const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/premier-list.html`);

module.exports = async (db) => {
  const data = {
    title: 'Premier Throwers',
    count: (await db.get(`
      SELECT COUNT(*) AS count
      FROM profiles
      WHERE premierRating > 0;
    `)).count,
    averageRating: (await db.get(`
      SELECT ROUND(AVG(premierRating)) AS average
      FROM profiles
      WHERE premierRating > 0;
    `)).average,
    averageScore: (await db.get(`
      SELECT ROUND(AVG(premierAverage), 3) AS average
      FROM profiles
      WHERE premierAverage > 0;
    `)).average,
    list: await db.query(`
      SELECT *
      FROM profiles
      WHERE premierRank > 0
      ORDER BY premierRank ASC, premierAverage DESC;
    `)
  };

  return render(page, {
    ...data,
    JSON: JSON.stringify(data.list, null, 2)
  });
};
