const fs = require('fs-extra');
const { render } = require('mustache');

const layout = fs.readFileSync(require.resolve('./_shell.html'), 'utf-8');

module.exports = ({ page, data, partials }) => {
  return render(layout, data, {
    ...(partials || {}),
    page
  });
};