const fs = require('fs-extra');
const path = require('path');
const { render } = require('mustache');

const layout = fs.readFileSync(path.resolve(__dirname, '../pages/_shell.html'), 'utf-8');

module.exports = ({ page, data, partials }) => {
  return render(layout, data, {
    ...(partials || {}),
    page
  });
};