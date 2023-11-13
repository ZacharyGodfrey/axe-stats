const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const config = require('../config');
const { db, badges, logError } = require('../helpers');

const CLIENT_DIR = path.resolve(__dirname, '../client');
const DIST_DIR = path.resolve(__dirname, '../dist');

const readFile = (filePath, encoding = 'utf-8') => {
  return fs.readFileSync(filePath, { encoding });
};

const writeFile = (filePath, content) => {
  console.log(`Writing file: ${filePath}`);

  return fs.outputFileSync(filePath, content, 'utf-8')
};

const getShell = () => {
  const robotoFont = readFile(`${CLIENT_DIR}/assets/roboto-mono.ttf`, 'base64');
  const stylesheet = readFile(`${CLIENT_DIR}/assets/style.css`);
  const chartJS = readFile(`${CLIENT_DIR}/assets/chart.js`);

  return readFile(`${CLIENT_DIR}/shell.html`)
    .replace('/*stylesheet*/', stylesheet)
    .replace('/*robotoFont*/', robotoFont)
    .replace('/*chartJS*/', chartJS);
};

const buildStaticPage = (shell, page, title) => render(shell, { title }, { page });

const buildBadgesPage = (shell) => {
  const data = {
    title: 'Badges',
    badges: {
      ...badges,
      secret: badges.secret.map(() => ({
        title: 'Secret Badge',
        description: 'Keep throwing to earn it'
      }))
    }
  };

  return render(shell, data, {
    page: readFile(`${CLIENT_DIR}/badges.html`)
  });
};

const buildHomePage = (shell, profiles) => {
  const data = {
    title: undefined,
    profiles,
    dataJson: JSON.stringify({ profiles })
  };

  return render(shell, data, {
    page: readFile(`${CLIENT_DIR}/home.html`)
  });
};

const buildProfilePage = (shell, profile) => {
  const data = {
    title: profile.name,
    profile,
    dataJson: JSON.stringify({ profile })
  };

  return render(shell, data, {
    page: readFile(`${CLIENT_DIR}/profile.html`),
    iconCheck: readFile(`${CLIENT_DIR}/assets/check.png`, 'base64')
  });
};

const matchText = ({ profileId, matchId, state, outcome, total, rounds }) => {
  switch (state) {
    case db.enums.matchState.invalid: return `${profileId} ${matchId} INVALID`;
    case db.enums.matchState.forfeit: return `${profileId} ${matchId} FORFEIT`;
  }

  return [
    profileId,
    matchId,
    outcome[0],
    total,
    ...rounds.flatMap(({ outcome, throws }) => [
      outcome[0],
      throws.map(({ score, clutch }) => score === 0 && clutch ? 'C' : score).join('')
    ])
  ].join(' ');
};

(() => {
  try {
    console.log(JSON.stringify({
      CLIENT_DIR,
      DIST_DIR,
      config
    }, null, 2));

    if (config.resetAllData) {
      throw new Error('Skipping build while config.resetAllData is true');
    }

    fs.emptyDirSync(DIST_DIR);
    fs.copySync(`${CLIENT_DIR}/static`, DIST_DIR);

    const shell = getShell();
    const profiles = db.rows(`
      SELECT *
      FROM profiles
      ORDER BY rank ASC, rating DESC
    `);

    writeFile(`${DIST_DIR}/404.html`, buildStaticPage(shell, readFile(`${CLIENT_DIR}/404.html`), 'Not Found'));
    writeFile(`${DIST_DIR}/500.html`, buildStaticPage(shell, readFile(`${CLIENT_DIR}/500.html`), 'Error'));
    writeFile(`${DIST_DIR}/rating-system.html`, buildStaticPage(shell, readFile(`${CLIENT_DIR}/rating-system.html`), 'Rating System'));
    writeFile(`${DIST_DIR}/badges.html`, buildBadgesPage(shell));
    writeFile(`${DIST_DIR}/index.html`, buildHomePage(shell, profiles));

    profiles.forEach(profile => {
      const seasons = db.rows(`
        SELECT *
        FROM seasons
        WHERE profileId = ?
        ORDER BY seasonId ASC
      `, [profile.profileId]);

      const matches = db.rows(`
        SELECT *
        FROM matches
        WHERE profileId = ?
        ORDER BY matchId DESC
      `, [profile.profileId]);

      matches.forEach(x => {
        x.rounds = JSON.parse(x.rounds);
        x.stats = JSON.parse(x.stats);
      });

      const validMatches = matches.filter(x => x.state === db.enums.matchState.valid);

      validMatches.forEach(x => {
        x.opponent = db.row(`
          SELECT profileId, name, image
          FROM profiles
          WHERE profileId = ?
        `, [x.opponentId]) || null;
      });

      profile.stats = JSON.parse(profile.stats);
      profile.badges = JSON.parse(profile.badges);
      profile.seasons = seasons.map((x, i) => ({ ...x, order: i + 1 })).reverse();
      profile.matches = validMatches;

      writeFile(`${DIST_DIR}/${profile.profileId}.html`, buildProfilePage(shell, profile));
      writeFile(`${DIST_DIR}/${profile.profileId}.json`, JSON.stringify(profile, null, 2));
      writeFile(`${DIST_DIR}/${profile.profileId}.txt`, matches.map(x => matchText(x)).join('\n'));
    });
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();