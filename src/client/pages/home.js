const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = async (db) => {
  const allProfiles = await db.allProfiles();
  const updatedAt = await db.timestamp();

  return render(page, { allProfiles, updatedAt });
};