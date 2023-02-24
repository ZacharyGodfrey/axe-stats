const { readFile, render } = require('../helpers');

const page = readFile(`${__dirname}/../content/compare.html`);

module.exports = async (db, leftId, rightId) => {
  const left = await db.getThrowerById(leftId);
  const right = await db.getThrowerById(rightId);

  return render(page, { left, right });
};