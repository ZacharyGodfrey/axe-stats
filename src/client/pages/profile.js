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
  },
  premierSeasons: [
    {
      id: 123,
      name: 'Fake Season Name',
      playoffSeed: ordinal(5),
      playoffRank: ordinal(1),
      highScore: 75,
      averageScore: 71.2,
      bullseyeCount: 409,
      bullseyePercent: 97.6,
      clutchCount: 25,
      clutchCallPercent: 33.3,
      clutchHitPercent: 19.7
    }
  ],
  standardSeasons: [],
});