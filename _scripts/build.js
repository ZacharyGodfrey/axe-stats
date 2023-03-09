const path = require('path');
const fs = require('fs-extra');

const db = require('../src/database');
const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

const buildBasicPages = async () => {
  const basicPages = {
    'index': client.home,
    '404': client.error404,
    '500': client.error500,
    'premier': client.premierList,
    'standard': client.standardList,
  };

  await Promise.all(Object.entries(basicPages).map(async ([name, render]) => {
    const fileName = `${distDir}/${name}.html`;
    const content = await render(db);

    console.log(`Writing File: ${fileName}`);

    await fs.outputFile(fileName, content, 'utf-8');
  }));
};

const buildProfilePages = async () => {
  const allProfiles = await db.query(`
    SELECT *
    FROM profiles
    WHERE premierRank > 0
    ORDER BY premierRank ASC, premierAverage DESC
    LIMIT 100;
  `);

  const tasks = allProfiles.map(async (profile) => {
    const fileName = `${distDir}/profile/${profile.id}.html`;
    const content = await client.profile(profile);

    console.log(`Writing File: ${fileName}`);

    await fs.outputFile(fileName, content, 'utf-8');
  });

  return Promise.all(tasks);
};

(async () => {
  try {
    await fs.emptyDir(distDir);
    await fs.copy(`${clientDir}/assets`, distDir);
    await buildBasicPages();
    await buildProfilePages();
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();
