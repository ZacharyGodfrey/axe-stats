const { byDescending } = require('../helpers');

const profiles = require('../data/throwers');

module.exports = (connection) => {
  return (count, type) => {
    const order = byDescending(x => type === 'premier' ? x.premierRating : x.standardRating);

    return profiles.sort(order).slice(0, count);
  };
};