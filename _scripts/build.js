const path = require('path');
const fs = require('fs-extra');

const client = path.resolve(__dirname, '../src/client');
const dist = path.resolve(__dirname, '../dist');

(async () => {
  await fs.emptyDir(dist);
  await fs.copy(`${client}/static`, dist);
  await fs.outputFile(`${dist}/404.html`, await client['not-found'](), 'utf-8');
})();