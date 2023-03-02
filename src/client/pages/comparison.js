const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/comparison.html`);

module.exports = async (db, leftId, rightId) => render(page, {
  title: 'Comparison',
  left: await db.getThrowerById(leftId),
  right: await db.getThrowerById(rightId)
});