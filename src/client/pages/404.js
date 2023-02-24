const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/404.html`);

module.exports = async () => {
  const title = 'Not Found';

  return render(page, { title });
};