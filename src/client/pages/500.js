const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/500.html`);

module.exports = async () => {
  const title = 'Server Error';

  return render(page, { title });
};