const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/comparison.html`);

module.exports = (db, leftId, rightId) => render(page, {
  title: 'Comparison',
  left: db.getThrowerById(leftId),
  right: db.getThrowerById(rightId)
});