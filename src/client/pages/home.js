const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = (db) => render(page, {
  topPremierThrowers: db.topThrowers(10, 'premier'),
  topStandardThrowers: db.topThrowers(10, 'standard')
});