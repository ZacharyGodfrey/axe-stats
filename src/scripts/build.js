const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const { db, sum, round, logError } = require('../helpers');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const DIST_DIR = path.resolve(__dirname, '../../dist');

const transformProfile = (profile) => {
  const matchCount = sum([
    profile.matchWin,
    profile.matchLoss,
    profile.matchOTL
  ]);

  const hatchetRoundCount = sum([
    profile.hatchetRoundWin,
    profile.hatchetRoundLoss,
    profile.hatchetRoundTie
  ]);

  const bigAxeRoundCount = sum([
    profile.bigAxeRoundWin,
    profile.bigAxeRoundLoss
  ]);

  return {
    ...profile,
    matchCount,
    matchAverageScore: round(profile.matchTotalScore / matchCount, 3),
    matchWinPercent: round(profile.matchWin / matchCount, 4),
    hatchetRoundCount,
    hatchetWinPercent: round(profile.hatchetRoundWin / hatchetRoundCount, 3),
    hatchetScorePerThrow: round(profile.hatchetTotalScore / profile.hatchetThrowCount, 3),
    hatchetClutchCallPercent: round(profile.hatchetClutchCall / (matchCount * 3), 3),
    hatchetClutchHitPercent: round(profile.hatchetClutchHit / profile.hatchetClutchCall, 3),
    bigAxeRoundCount,
    bigAxeWinPercent: round(profile.bigAxeRoundWin / bigAxeRoundCount, 3),
    bigAxeScorePerThrow: round(profile.bigAxeTotalScore / profile.bigAxeThrowCount, 3),
    bigAxeClutchCallPercent: round(profile.bigAxeClutchCall / (matchCount * 3), 3),
    bigAxeClutchHitPercent: round(profile.bigAxeClutchHit / profile.bigAxeClutchCall, 3),
    percentage: {
      matchWin: `${100 * round(profile.matchWin / matchCount, 4)}%`
    }
  };
};

const getProfiles = async () => {
  console.log('Get Profiles');

  const profiles = await db.query(`
    SELECT *
    FROM profiles
    ORDER BY rank ASC, rating DESC;
  `);

  return profiles.map(x => transformProfile(x));
};

const readFile = (filePath) => {
  return fs.readFile(filePath, 'utf-8');
};

const writeFile = (filePath, content) => {
  console.log(`Write File: ${filePath}`);

  return fs.outputFile(filePath, content, 'utf-8');
};

const buildHomePage = async (shell, profiles) => {
  console.log('Building home page');

  const page = await readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles
  };

  return render(shell, data, { page });
};

const build404Page = async (shell) => {
  console.log('Building 404 page');

  const page = await readFile(`${CLIENT_DIR}/404.html`);
  const data = {
    title: 'Not Found'
  };

  return render(shell, data, { page });
};

const build500Page = async (shell) => {
  console.log('Building 500 page');

  const page = await readFile(`${CLIENT_DIR}/500.html`);
  const data = {
    title: 'Error',
  };

  return render(shell, data, { page });
};

const buildProfilePage = async (shell, profile) => {
  console.log(`Building profile page for profile ID ${profile.id}`);

  const page = await readFile(`${CLIENT_DIR}/profile.html`);
  const data = {
    title: profile.name,
    profile
  };

  return render(shell, data, { page });
};

(async () => {
  try {
    console.log('# Build Site');
    console.log(JSON.stringify({
      CLIENT_DIR,
      DIST_DIR
    }, null, 2));

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

    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();