const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const topPremierThrowers = await db.topThrowers(10, 'premier');
  const topStandardThrowers = await db.topThrowers(10, 'standard');

  return render(page, { topPremierThrowers, topStandardThrowers });
};