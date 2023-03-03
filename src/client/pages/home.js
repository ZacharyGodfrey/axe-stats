const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => render(page, {
  topPremierThrowers: await db.topProfiles(10, 'premierRating', 'desc'),
  topStandardThrowers: await db.topProfiles(10, 'standardRating', 'desc'),
  updatedAt: await db.timestamp()
});