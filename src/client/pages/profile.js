const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

module.exports = async (profile) => render(page, {
  title: profile.name,
  profile
});