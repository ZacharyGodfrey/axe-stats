const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/404.html`);

module.exports = async () => render(page, {
  title: 'Not Found'
});