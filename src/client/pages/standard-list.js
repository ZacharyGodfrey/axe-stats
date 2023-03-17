const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/standard-list.html`);

module.exports = async (db) => {
  const data = {
    title: 'Standard Throwers',
    count: (await db.get(`
      SELECT COUNT(*) AS count
      FROM profiles
      WHERE standardRating > 0;
    `)).count,
    averageRating: (await db.get(`
      SELECT ROUND(AVG(standardRating)) AS average
      FROM profiles
      WHERE standardRating > 0;
    `)).average,
    averageScore: (await db.get(`
      SELECT ROUND(AVG(standardAverage), 3) AS average
      FROM profiles
      WHERE standardAverage > 0;
    `)).average,
    list: await db.query(`
      SELECT *
      FROM profiles
      WHERE standardRank > 0
      ORDER BY standardRank ASC, standardAverage DESC;
    `)
  };

  return render(page, {
    ...data,
    JSON: JSON.stringify(data, null, 2)
  });
};
