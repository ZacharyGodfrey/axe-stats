const fs = require('fs-extra');
const path = require('path');
const { render } = require('mustache');

const config = require('../config');
const readFile = require('./read-file');

const layout = readFile(`${__dirname}/../content/_shell.html`);

module.exports = (pageContent, pageData, pagePartials) => {
  const data = {
    config,
    page: pageData || {}
  };

  const partials = {
    ...(pagePartials || {}),
    page: `${pageContent}\n`
  };

  return render(layout, data, partials);
};