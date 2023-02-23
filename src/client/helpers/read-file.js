const fs = require('fs-extra');
const path = require('path');

module.exports = (filePath) => fs.readFileSync(path.resolve(filePath), 'utf-8');