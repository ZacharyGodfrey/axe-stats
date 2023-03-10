const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

const ordinal = (value) => {
  switch (true) {
    case value <= 0: return 'N/A';
    case value % 10 === 1: return `${value}st`;
    case value % 10 === 2: return `${value}nd`;
    case value % 10 === 3: return `${value}rd`;
    default: return `${value}th`;
  }
};

module.exports = async (profile) => render(page, {
  title: profile.name,
  profile: {
    ...profile,
    premierRank: ordinal(profile.premierRank),
    standardRank: ordinal(profile.standardRank),
  }
});