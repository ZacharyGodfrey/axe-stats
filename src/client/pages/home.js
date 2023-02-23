const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const topThrowers = await db.topThrowers(10);

  return render(page, { topThrowers });
};