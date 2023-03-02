const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/500.html`);

module.exports = async () => render(page, {
  title: 'Server Error'
});