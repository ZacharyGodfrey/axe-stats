const fs = require('fs-extra');
const { render } = require('mustache');

module.exports = async (db, user) => {
  const [layout, page, profiles] = await Promise.all([
    fs.readFile(require.resolve('./_shell.html'), 'utf-8'),
    fs.readFile(require.resolve('./home.html'), 'utf-8'),
    db.listProfiles()
  ]);

  const data = {
    user,
    page: {
      title: 'Axe Stats - Home',
    },
    profiles
  };

  return render(layout, data, { page });
};