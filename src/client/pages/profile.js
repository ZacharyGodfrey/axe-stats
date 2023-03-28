const { readFile, render, ordinal } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

module.exports = (profile) => render(page, {
  title: profile.name,
  profile: {
    ...profile,
    premierRank: ordinal(profile.premierRank),
    standardRank: ordinal(profile.standardRank),
  }
});