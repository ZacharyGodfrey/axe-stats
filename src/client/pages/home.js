const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => render(page, {
  topPremierThrowers: await db.topProfiles('premierRating', 'desc', 10),
  topStandardThrowers: await db.topProfiles('standardRating', 'desc', 10),
  updatedAt: await db.timestamp()
});