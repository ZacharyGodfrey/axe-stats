const { byDescending } = require('../helpers');

const profiles = [
  {
    id: '123',
    name: 'REDACTED',
    standardRating: 1509,
    premierRating: 1600
  },
  {
    id: '234',
    name: 'Beginner',
    standardRating: 1200,
    premierRating: 1050
  }
];

module.exports = (connection) => {
  return (count, type) => {
    const order = byDescending(x => type === 'premier' ? x.premierRating : x.standardRating);

    return profiles.sort(order).slice(0, count);
  };
};