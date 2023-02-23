const fs = require('fs-extra');
const path = require('path');
const { render } = require('mustache');

const config = require('../config');

const layout = fs.readFileSync(path.resolve(__dirname, '../pages/_shell.html'), 'utf-8');

module.exports = (pageContent, pageData, pagePartials) => {
  const data = {
    config,
    page: pageData || {}
  };

  const partials = {
    ...(pagePartials || {}),
    page: pageContent
  };

  return render(layout, data, partials);
};