const { readFile, render, sum, average, round } = require('../helpers');

const page = readFile(`${__dirname}/../content/home.html`);

module.exports = ({ timestamp, profiles }) => {
  const ratedProfiles = profiles.filter((x) => x.rating > 0);

  return render(page, {
    timestamp,
    totalCount: profiles.length,
    stats: {
      count: ratedProfiles.length,
      averageRating: round(average(ratedProfiles.map(x => x.rating))),
      averageScore: round(average(ratedProfiles.map(x => x.average)), 2),
    },
    profilesJSON: JSON.stringify(ratedProfiles)
  });
};
