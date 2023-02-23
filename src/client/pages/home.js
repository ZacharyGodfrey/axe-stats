const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const title = 'Home';
  const profiles = await db.listProfiles();

  return render(page, { title, profiles });
};