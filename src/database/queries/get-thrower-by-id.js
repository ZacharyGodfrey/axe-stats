const profiles = require('../data/throwers');

module.exports = (connection) => {
  return (id) => {
    return profiles.find(x => x.id === id);
  };
};