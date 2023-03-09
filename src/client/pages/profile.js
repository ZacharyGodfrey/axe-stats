const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

const ordinal = (value) => {
  switch (value) {
    case 0: return 'N/A';
    case 1: return '1st';
    case 2: return '2nd';
    case 3: return '3rd';
    default: return `${value}th`;
  }
};

module.exports = async (profile) => render(page, {
  title: profile.name,
  profile,
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