const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const config = require('../config');
const { db, badges, roundForDisplay, average, logError } = require('../helpers');

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
  const favicon = readFile(`${CLIENT_DIR}/assets/favicon.ico`, 'base64');
  const robotoFont = readFile(`${CLIENT_DIR}/assets/roboto-mono.ttf`, 'base64');
  const stylesheet = readFile(`${CLIENT_DIR}/assets/style.css`);
  const chartJS = readFile(`${CLIENT_DIR}/assets/chart.js`);

  return readFile(`${CLIENT_DIR}/shell.html`)
    .replace('/*favicon*/', favicon)
    .replace('/*stylesheet*/', stylesheet)
    .replace('/*robotoFont*/', robotoFont)
    .replace('/*chartJS*/', chartJS);
};

const buildStaticPage = (shell, page, title) => render(shell, { title }, { page });

const buildRatingSystemPage = (shell, profiles) => {
  const slimProfiles = profiles.map(x => ({ ...x, seasons: undefined, matches: undefined }));
  const data = {
    title: 'ACR',
    profiles: slimProfiles,
    averageRating: Math.round(average(slimProfiles.map(x => x.stats.acr.rating))),
    dataJson: JSON.stringify({ profiles: slimProfiles })
  };

  return render(shell, data, {
    page: readFile(`${CLIENT_DIR}/rating-system.html`)
  });
};

const buildBadgesPage = (shell, profiles) => {
  const data = {
    title: 'Badges',
    badges: badges.map(({ type, title, description }) => {
      const isSecret = type === 'Secret';
      const earnedCount = profiles.filter(x => x.badges.some(y => y.title === title)).length;
      const earnedPercent = roundForDisplay(100 * earnedCount / profiles.length);

      return {
        type,
        title: isSecret ? 'Secret Badge' : title,
        description: isSecret ? 'Keep throwing to earn it' : description,
        earnedPercent
      };
    })
  };

  return render(shell, data, {
    page: readFile(`${CLIENT_DIR}/badges.html`),
    iconBadge: readFile(`${CLIENT_DIR}/assets/badge.png`, 'base64')
  });
};

const buildHomePage = (shell, profiles) => {
  const slimProfiles = profiles.map(x => ({ ...x, seasons: undefined, matches: undefined }));
  const data = {
    title: undefined,
    profiles: slimProfiles,
    dataJson: JSON.stringify({ profiles: slimProfiles })
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
    iconBadge: readFile(`${CLIENT_DIR}/assets/badge.png`, 'base64')
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

    const shell = getShell();
    const profiles = db.rows(`
      SELECT *
      FROM profiles
      ORDER BY rank ASC, rating DESC
    `);

    profiles.forEach(profile => {
      const seasons = db.rows(`
        SELECT *
        FROM seasons
        WHERE profileId = ?
        ORDER BY seasonId DESC
      `, [profile.profileId]);

      seasons.forEach(x => {
        x.stats = JSON.parse(x.stats);
      });

      const matches = db.rows(`
        SELECT *
        FROM matches
        WHERE profileId = ?
        ORDER BY seasonId DESC, week DESC, matchId DESC
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
      profile.matches = validMatches;
      profile.seasons = seasons.map((x, i, { length }) => ({ ...x, order: length - i }));
      profile.badges = badges.filter(x => x.earned(profile));

      writeFile(`${DIST_DIR}/${profile.profileId}.html`, buildProfilePage(shell, profile));
      writeFile(`${DIST_DIR}/${profile.profileId}.json`, JSON.stringify(profile, null, 2));
      writeFile(`${DIST_DIR}/${profile.profileId}.txt`, matches.map(x => matchText(x)).join('\n'));
    });

    writeFile(`${DIST_DIR}/404.html`, buildStaticPage(shell, readFile(`${CLIENT_DIR}/404.html`), 'Not Found'));
    writeFile(`${DIST_DIR}/500.html`, buildStaticPage(shell, readFile(`${CLIENT_DIR}/500.html`), 'Error'));
    writeFile(`${DIST_DIR}/rating-system.html`, buildRatingSystemPage(shell, profiles));
    writeFile(`${DIST_DIR}/badges.html`, buildBadgesPage(shell, profiles));
    writeFile(`${DIST_DIR}/index.html`, buildHomePage(shell, profiles));
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();