const fs = require('fs-extra');
const path = require('path');

const render = require('../helpers/render');

const page = fs.readFileSync(path.resolve(__dirname, './home.html'), 'utf-8');

module.exports = {
  route: '',
  render: async (db) => {
    const title = 'Home';
    const profiles = await db.listProfiles();

    return render(page, { title, profiles });
  }
};