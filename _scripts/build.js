const path = require('path');
const fs = require('fs-extra');

const db = require('../src/database');
const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

try {
  fs.emptyDirSync(distDir);

  fs.copySync(`${clientDir}/assets`, distDir);

  db.connect();

  const basicPages = {
    'index': client['home'],
    '404': client['404'],
    '500': client['500'],
  };

  Object.entries(basicPages).forEach(([name, render]) => {
    const fileName = `${distDir}/${name}.html`;
    const content = render(db);

    console.log(`Writing File: ${fileName}`);

    fs.outputFileSync(fileName, `<!-- Rendered during build step -->\n${content}`, 'utf-8');
  })

  // TODO: Query the database and render profile pages based on data
} catch (error) {
  console.log(error);
} finally {
  db.disconnect();
}