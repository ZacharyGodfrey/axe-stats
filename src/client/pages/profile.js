const { readFile, render, ordinal } = require('../helpers');

const page = readFile(`${__dirname}/../content/profile.html`);

module.exports = (profile) => render(page, {
  title: profile.name,
  profile: {
    ...profile,
    rank: ordinal(profile.rank)
  },
  matches: require(`../../database/profiles/${profile.id}.json`).matches
});