const path = require('path');
const fs = require('fs-extra');

const client = path.resolve(__dirname, '../src/client');
const dist = path.resolve(__dirname, '../dist');

fs.emptyDirSync(dist);
fs.copySync(`${client}/static`, dist);
fs.outputFileSync(`${dist}/timestamp.txt`, new Date().toISOString(), 'utf-8');