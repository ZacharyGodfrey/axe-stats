const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/not-found.html`);

module.exports = async () => {
  const title = 'Not Found';

  return render(page, { title });
};