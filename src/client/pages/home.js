const fs = require('fs-extra');
const path = require('path');

const render = require('../helpers/render');

module.exports = async (db, user) => {
  const [page, profiles] = await Promise.all([
    fs.readFile(path.resolve(__dirname, './home.html'), 'utf-8'),
    db.listProfiles()
  ]);

  const data = {
    user,
    title: 'Axe Stats - Home',
    profiles
  };

  return render({ page, data });
};