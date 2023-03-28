const { readFile, render, sum, average, round } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = ({ timestamp, profiles }) => {
  const standard = profiles.filter((x) => x.standardRating > 0);
  const premier = profiles.filter((x) => x.premierRating > 0);

  return render(page, {
    timestamp,
    totalCount: profiles.length,
    standard: {
      count: standard.length,
      averageRating: round(average(standard.map(x => x.standardRating))),
      averageScore: round(average(standard.map(x => x.standardAverage)), 2),
    },
    premier: {
      count: premier.length,
      averageRating: round(average(premier.map(x => x.premierRating))),
      averageScore: round(average(premier.map(x => x.premierAverage)), 2),
    },
    profilesJSON: JSON.stringify(profiles)
  });
};
