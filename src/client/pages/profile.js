const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

module.exports = async (profile, updatedAt) => render(page, {
  title: profile.name,
  profile,
  updatedAt
});