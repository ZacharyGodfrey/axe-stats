const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => render(page, {
  topPremierThrowers: await db.topThrowers(10, 'premier'),
  topStandardThrowers: await db.topThrowers(10, 'standard'),
  updatedAt: await db.timestamp()
});