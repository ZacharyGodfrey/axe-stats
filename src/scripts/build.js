const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

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

const readFile = (filePath) => {
  return fs.readFile(filePath, 'utf-8');
};

const writeFile = (filePath, content) => {
  console.log(`Write File: ${filePath}`);

  return fs.outputFile(filePath, content, 'utf-8');
};

const buildHomePage = async (shell, profiles) => {
  const page = await readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles
  };

  return render(shell, data, { page });
};

const build404Page = async (shell) => {
  const page = await readFile(`${CLIENT_DIR}/404.html`);
  const data = {
    title: 'Not Found'
  };

  return render(shell, data, { page });
};

const build500Page = async (shell) => {
  const page = await readFile(`${CLIENT_DIR}/500.html`);
  const data = {
    title: 'Error',
  };

  return render(shell, data, { page });
};

const buildProfilePage = async (shell, profile) => {
  const page = await readFile(`${CLIENT_DIR}/profile.html`);
  const data = {
    title: profile.name,
    profile
  };

  return render(shell, data, { page });
};

(async () => {
  try {
    console.log('Build Site');

    await fs.emptyDir(DIST_DIR);
    await fs.copy(`${CLIENT_DIR}/static`, DIST_DIR);

    const [profiles, shell] = await Promise.all([
      getProfiles(),
      readFile(`${CLIENT_DIR}/shell.html`)
    ]);

    await Promise.all([
      writeFile(`${DIST_DIR}/data.json`, JSON.stringify(profiles, null, 2)),
      buildHomePage(shell, profiles).then(page => writeFile(`${DIST_DIR}/index.html`, page)),
      build404Page(shell).then(page => writeFile(`${DIST_DIR}/404.html`, page)),
      build500Page(shell).then(page => writeFile(`${DIST_DIR}/500.html`, page)),
      ...profiles.map(profile => {
        return buildProfilePage(shell, profile).then(page => writeFile(`${DIST_DIR}/${profile.id}/index.html`, page))
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