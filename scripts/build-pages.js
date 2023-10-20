const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const { db, logError } = require('./helpers');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const DIST_DIR = path.resolve(__dirname, '../dist');

const readFile = (filePath, encoding = 'utf-8') => fs.readFileSync(filePath, { encoding });

const writeFile = (filePath, content) => fs.outputFileSync(filePath, content, 'utf-8');

const getShell = () => {
  const robotoFont = readFile(`${CLIENT_DIR}/assets/roboto-mono.ttf`, 'base64');
  const chartJS = readFile(`${CLIENT_DIR}/assets/chart.js`);

  return readFile(`${CLIENT_DIR}/shell.html`)
    .replace('//robotoFont//', robotoFont)
    .replace('//chartJS//', chartJS);
};

const buildHomePage = (shell, profiles) => {
  console.log('Building home page');

  const page = readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles,
    profilesJson: JSON.stringify(profiles, null, 2)
  };

  return render(shell, data, { page });
};

const build404Page = (shell) => {
  console.log('Building 404 page');

  const page = readFile(`${CLIENT_DIR}/404.html`);
  const data = {
    title: 'Not Found'
  };

  return render(shell, data, { page });
};

const build500Page = (shell) => {
  console.log('Building 500 page');

  const page = readFile(`${CLIENT_DIR}/500.html`);
  const data = {
    title: 'Error',
  };

  return render(shell, data, { page });
};

const writeProfileContent = (shell, profiles) => {
  const globalStats = getGlobalStats();

  profiles.forEach(profile => {
    const matches = db.all(`
      SELECT *
      FROM matches
      WHERE profileId = ?
      ORDER BY matchId ASC
    `, [profile.profileId]);

    matches.forEach(x => x.stats = JSON.parse(x.stats));

    const page = buildProfilePage(shell, {
      profile,
      matches: matches.filter(x => x.state === db.enums.matchState.valid),
      globalStats
    });

    writeFile(`${DIST_DIR}/${profile.profileId}.html`, page);
    writeFile(`${DIST_DIR}/${profile.profileId}.json`, JSON.stringify({ profile, matches }, null, 2));
    writeFile(`${DIST_DIR}/${profile.profileId}.txt`, matches.map(x => x.text).join('\n'));
  });
};

const getGlobalStats = () => {
  return db.one(`
    SELECT min(total) AS minScore, max(total) AS maxScore
    FROM matches
    WHERE state = ? AND total > 0
  `, [db.enums.matchState.valid]);
};

const buildProfilePage = (shell, { profile, matches, globalStats }) => {
  console.log(`Building profile page for profile ID ${profile.profileId}`);

  const page = readFile(`${CLIENT_DIR}/profile.html`);
  const data = {
    title: profile.name,
    profile,
    profileJson: JSON.stringify(profile),
    matchesJson: JSON.stringify(matches),
    globalStatsJson: JSON.stringify(globalStats)
  };

  return render(shell, data, { page });
};

(() => {
  try {
    console.log(JSON.stringify({
      CLIENT_DIR,
      DIST_DIR
    }, null, 2));

    fs.emptyDirSync(DIST_DIR);
    fs.copySync(`${CLIENT_DIR}/static`, DIST_DIR);

    const shell = getShell();
    const profiles = db.all(`
      SELECT *
      FROM profiles
      ORDER BY rank ASC, rating DESC
    `);

    profiles.forEach(x => x.stats = JSON.parse(x.stats));

    writeFile(`${DIST_DIR}/index.html`, buildHomePage(shell, profiles));
    writeFile(`${DIST_DIR}/404.html`, build404Page(shell));
    writeFile(`${DIST_DIR}/500.html`, build500Page(shell));

    writeProfileContent(shell, profiles);
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();