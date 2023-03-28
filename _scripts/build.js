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
    WHERE id = 1207260
    OR (1 <= premierRank AND premierRank <= 10);
  `);

  const tasks = allProfiles.map(async (profile) => {
    const fileName = `${distDir}/profile/${profile.id}.html`;
    const content = await client.profile(profile);

    console.log(`Writing File: ${fileName}`);

    await fs.outputFile(fileName, content, 'utf-8');
  });

  return Promise.all(tasks);
};

const buildJsonDump = async () => {
  const allSeasons = await db.query(`SELECT * FROM seasons;`);
  const allProfiles = await db.query(`
    SELECT *
    FROM profiles
    ORDER BY
      isActive ASC,
      premierRating DESC,
      premierAverage DESC,
      standardRating DESC,
      standardAverage DESC;
  `);

  const fileName = `${distDir}/all-data.json`;
  const fileContent = await JSON.stringify({
    allSeasons,
    allProfiles
  }, null, 2);

  console.log(`Writing File: ${fileName}`);

  await fs.outputFile(fileName, fileContent, 'utf-8');
};

(async () => {
  try {
    await fs.emptyDir(distDir);
    await fs.copy(`${clientDir}/assets`, distDir);
    await buildBasicPages();
    await buildProfilePages();
    await buildJsonDump();
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();
