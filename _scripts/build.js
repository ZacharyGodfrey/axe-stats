const path = require('path');
const fs = require('fs-extra');

const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

(async () => {
  await fs.emptyDir(distDir);
  await fs.copy(`${clientDir}/static`, distDir);
  await fs.outputFile(`${distDir}/404.html`, await client['not-found'](), 'utf-8');
})();