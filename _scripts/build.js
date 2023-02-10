const path = require('path');
const fs = require('fs-extra');

const dist = path.resolve(`${__dirname}/../dist`);

fs.emptyDirSync(dist);
fs.outputFileSync(`${dist}/timestamp.txt`, new Date().toISOString(), 'utf-8');