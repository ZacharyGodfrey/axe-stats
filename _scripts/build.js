const path = require('path');
const fs = require('fs-extra');

const db = require('../src/database');
const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

(async () => {
  try {
    await fs.emptyDir(distDir);

    await fs.copy(`${clientDir}/assets`, distDir);

    const filePrefix = '<!-- Rendered during build step -->';
    const basicPages = {
      'index': client.home,
      '404': client['404'],
      '500': client['500'],
    };

    await Promise.all(Object.entries(basicPages).map(async ([name, render]) => {
      const fileName = `${distDir}/${name}.html`;
      const content = await render(db);

      console.log(`Writing File: ${fileName}`);

      await fs.outputFile(fileName, `${filePrefix}\n${content}`, 'utf-8');
    }));

    const [{ timestamp }] = await db.query(`SELECT * FROM timestamp LIMIT 1;`);
    const allProfiles = await db.query(`
      SELECT *
      FROM profiles
      WHERE premierRank > 0
      ORDER BY premierRank ASC, premierAverage DESC
      LIMIT 256;
    `);

    await Promise.all(allProfiles.map(async (profile) => {
      const fileName = `${distDir}/profile/${profile.id}.html`;
      const content = await client.profile(profile, timestamp);

      console.log(`Writing File: ${fileName}`);

      await fs.outputFile(fileName, `${filePrefix}\n${content}`, 'utf-8');
    }));
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();
