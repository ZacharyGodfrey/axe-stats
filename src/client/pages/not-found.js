const fs = require('fs-extra');
const path = require('path');

const render = require('../helpers/render');

const page = fs.readFileSync(path.resolve(__dirname, './404.html'), 'utf-8');

module.exports = {
  route: 'not-found',
  render: async () => render(page, { title: 'Not Found' })
};