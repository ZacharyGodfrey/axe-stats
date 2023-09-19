const path = require('path');
const fs = require('fs-extra');

const DB = require('../helpers/database');

const CWD = process.cwd();
const CLIENT_DIR = path.resolve(CWD, '/src/client');
const DIST_DIR = path.resolve(CWD, '/dist');

const getProfiles = () => {
  console.log('Get Profiles');

  return DB.query(`
    SELECT *
    FROM profiles
    ORDER BY id ASC;
  `);
};

const writeFile = (name, content) => {
  const filePath = `${DIST_DIR}/${name}`;

  console.log(`Write File: ${filePath}`);

  return fs.outputFile(filePath, content, 'utf-8');
};

const buildIndexPage = async (profiles) => {
  //
};

const build404Page = async () => {
  //
};

const build500Page = async () => {
  //
};

const buildProfilePage = async (profile) => {
  //
};

(async () => {
  try {
    console.log('Build Site');

    await fs.emptyDir(DIST_DIR);
    await fs.copy(`${CLIENT_DIR}/static`, DIST_DIR);

    const profiles = await getProfiles();

    await Promise.all([
      writeFile('data.json', JSON.stringify(profiles, null, 2)),
      buildIndexPage(profiles).then(page => writeFile('index.html', page)),
      build404Page().then(page => writeFile('404.html', page)),
      build500Page().then(page => writeFile('500.html', page)),
      ...profiles.map(profile => {
        return buildProfilePage(profile).then(page => writeFile(`${profile.id}/index.html`, page))
      })
    ]);
  } catch (error) {
    console.log('**********');
    console.log(JSON.stringify({
      message: error.message,
      stack: error.stack.split('\n').slice(1)
    }, null, 2));
    console.log('**********');

    process.exit(1);
  }
})();