const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const { db, sum, round, logError } = require('../helpers');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const DIST_DIR = path.resolve(__dirname, '../../dist');

const roundForDisplay = (value) => value === NaN ? 0 : round(value, 2);

const transformProfile = (profile) => {
  const { id, name, about, rank, rating, image } = profile;

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

  const hatchetClutchScore = 7 * profile.hatchetClutchHit;
  const hatchetTargetScore = sum([
    5 * profile.hatchetFive,
    3 * profile.hatchetThree,
    1 * profile.hatchetOne,
  ]);

  const hatchetTargetThrowCount = sum([
    profile.hatchetFive,
    profile.hatchetThree,
    profile.hatchetOne,
    profile.hatchetDrop,
  ]);

  const bigAxeRoundCount = sum([
    profile.bigAxeRoundWin,
    profile.bigAxeRoundLoss
  ]);

  const bigAxeClutchScore = 7 * profile.bigAxeClutchHit;
  const bigAxeTargetScore = sum([
    5 * profile.bigAxeFive,
    3 * profile.bigAxeThree,
    1 * profile.bigAxeOne,
  ]);

  const bigAxeTargetThrowCount = sum([
    profile.bigAxeFive,
    profile.bigAxeThree,
    profile.bigAxeOne,
    profile.bigAxeDrop,
  ]);

  return {
    id,
    name,
    about,
    rank,
    rating,
    image,
    match: {
      win: profile.matchWin,
      loss: profile.matchLoss,
      otl: profile.matchOTL,
      count: matchCount,
      totalScore: profile.matchTotalScore,
      averageScore: roundForDisplay(profile.matchTotalScore / matchCount),
      winPercent: roundForDisplay(profile.matchWin / matchCount * 100),
    },
    hatchet: {
      roundWin: profile.hatchetRoundWin,
      roundLoss: profile.hatchetRoundLoss,
      roundTie: profile.hatchetRoundTie,
      roundCount: hatchetRoundCount,
      winPercent: roundForDisplay(profile.hatchetRoundWin / hatchetRoundCount * 100),
      totalScore: profile.hatchetTotalScore,
      throwCount: profile.hatchetThrowCount,
      scorePerThrow: roundForDisplay(profile.hatchetTotalScore / profile.hatchetThrowCount),
      clutch: {
        call: profile.hatchetClutchCall,
        hit: profile.hatchetClutchHit,
        totalScore: hatchetClutchScore,
        callPercent: roundForDisplay(profile.hatchetClutchCall / hatchetRoundCount * 100),
        hitPercent: roundForDisplay(profile.hatchetClutchHit / profile.hatchetClutchCall * 100),
        ev: roundForDisplay(hatchetClutchScore / profile.hatchetClutchCall),
      },
      target: {
        five: profile.hatchetFive,
        three: profile.hatchetThree,
        one: profile.hatchetOne,
        drop: profile.hatchetDrop,
        fivePercent: roundForDisplay(profile.hatchetFive / hatchetTargetThrowCount * 100),
        threePercent: roundForDisplay(profile.hatchetThree / hatchetTargetThrowCount * 100),
        onePercent: roundForDisplay(profile.hatchetOne / hatchetTargetThrowCount * 100),
        dropPercent: roundForDisplay(profile.hatchetDrop / hatchetTargetThrowCount * 100),
        totalScore: hatchetTargetScore,
        throwCount: hatchetTargetThrowCount,
        ev: roundForDisplay(hatchetTargetScore / hatchetTargetThrowCount),
      }
    },
    bigAxe: {
      roundWin: profile.bigAxeRoundWin,
      roundLoss: profile.bigAxeRoundLoss,
      roundCount: bigAxeRoundCount,
      winPercent: roundForDisplay(profile.bigAxeRoundWin / bigAxeRoundCount * 100),
      totalScore: profile.bigAxeTotalScore,
      throwCount: profile.bigAxeThrowCount,
      scorePerThrow: roundForDisplay(profile.bigAxeTotalScore / profile.bigAxeThrowCount),
      clutch: {
        call: profile.bigAxeClutchCall,
        hit: profile.bigAxeClutchHit,
        totalScore: bigAxeClutchScore,
        hitPercent: roundForDisplay(profile.bigAxeClutchHit / profile.bigAxeClutchCall * 100),
        ev: roundForDisplay(bigAxeClutchScore / profile.bigAxeClutchCall),
      },
      target: {
        five: profile.bigAxeFive,
        three: profile.bigAxeThree,
        one: profile.bigAxeOne,
        drop: profile.bigAxeDrop,
        fivePercent: roundForDisplay(profile.bigAxeFive / bigAxeTargetThrowCount * 100),
        threePercent: roundForDisplay(profile.bigAxeThree / bigAxeTargetThrowCount * 100),
        onePercent: roundForDisplay(profile.bigAxeOne / bigAxeTargetThrowCount * 100),
        dropPercent: roundForDisplay(profile.bigAxeDrop / bigAxeTargetThrowCount * 100),
        totalScore: bigAxeTargetScore,
        throwCount: bigAxeTargetThrowCount,
        ev: roundForDisplay(bigAxeTargetScore / bigAxeTargetThrowCount),
      }
    },
    matches: profile.matches
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

const getMatches = async () => {
  console.log('Get Matches');

  const matches = await db.query(`
    SELECT *
    FROM matches
    WHERE processed = 1
    ORDER BY id asc;
  `);

  return matches.reduce((result, match) => {
    result[match.profileId] = result[match.profileId] || [];

    result[match.profileId].push(match);

    return result;
  }, {});
};

const readFile = (filePath, encoding = 'utf-8') => {
  return fs.readFile(filePath, { encoding });
};

const writeFile = (filePath, content) => {
  console.log(`Write File: ${filePath}`);

  return fs.outputFile(filePath, content, 'utf-8');
};

const getShell = async () => {
  let [shell, robotoFont] = await Promise.all([
    readFile(`${CLIENT_DIR}/shell.html`),
    readFile(`${CLIENT_DIR}/assets/roboto-mono.ttf`, 'base64'),
  ]);

  shell = shell.replace('**robotoFont**', robotoFont);

  return shell;
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

    const [profiles, matches, shell] = await Promise.all([
      getProfiles(),
      getMatches(),
      getShell()
    ]);

    profiles.forEach((profile) => {
      profile.matches = matches[profile.id];
    });

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