const path = require('path');
const fs = require('fs-extra');

const db = require('../src/database');
const client = require('../src/client');

const clientDir = path.resolve(__dirname, '../src/client');
const distDir = path.resolve(__dirname, '../dist');

const getAllData = async () => {
  return {
    timestamp: require('../src/database/timestamp.json'),
    profiles: (await db.query(`
      SELECT *
      FROM profiles
      ORDER BY rating DESC, average DESC;
    `)).map(x => Object.assign(x, {
      matches: require(`../src/database/profiles/${x.id}.json`).matches
    })),
    matches: await db.query(`
      SELECT *
      FROM matches
      ORDER BY id ASC;
    `)
  };
};

const writeFile = (name, content) => {
  const filePath = `${distDir}/${name}`;

  console.log(`Writing File: ${filePath}`);

  return fs.outputFile(filePath, content, 'utf-8');
};

(async () => {
  try {
    await fs.emptyDir(distDir);
    await fs.copy(`${clientDir}/assets`, distDir);

    const allData = await getAllData();

    await writeFile('data.json', JSON.stringify(allData, null, 2));
    await writeFile('index.html', client.home(allData));
    await writeFile('404.html', client.error404());
    await writeFile('500.html', client.error500());
    await writeFile('profiles.html', await client.profiles(db));

    await Promise.all(allData.profiles.map(async (profile) => {
      await writeFile(`profile/${profile.id}.html`, client.profile(profile));
    }));
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();
