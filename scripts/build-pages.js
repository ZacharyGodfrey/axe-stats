const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const config = require('../config');
const { db, badges, median, roundForDisplay, logError } = require('../helpers');

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
  const page = readFile(`${CLIENT_DIR}/home.html`);
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

  return render(shell, data, { page });
};

const buildHomePage = (shell, profiles) => {
  const page = readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles,
    dataJson: JSON.stringify({ profiles })
  };

  return render(shell, data, { page });
};

const buildProfilePage = (shell, profile) => {
  const page = readFile(`${CLIENT_DIR}/profile.html`);
  const data = {
    title: profile.name,
    profile,
    dataJson: JSON.stringify({ profile })
  };

  return render(shell, data, { page });
};

const analyzeMatch = (rounds) => {
  const stats = {
    hatchet: {
      roundWin: 0,
      roundLoss: 0,
      roundTie: 0,
      roundCount: 0,
      totalScore: 0,
      clutch: {
        call: 0,
        hit: 0,
        totalScore: 0,
      },
      target: {
        five: 0,
        three: 0,
        one: 0,
        drop: 0,
        totalScore: 0,
        throwCount: 0,
      }
    },
    bigAxe: {
      roundWin: 0,
      roundLoss: 0,
      roundCount: 0,
      totalScore: 0,
      clutch: {
        call: 0,
        hit: 0,
        totalScore: 0,
      },
      target: {
        five: 0,
        three: 0,
        one: 0,
        drop: 0,
        totalScore: 0,
        throwCount: 0,
      }
    }
  };

  rounds.forEach(({ outcome, total, throws, bigAxe }) => {
    const category = bigAxe ? stats.bigAxe : stats.hatchet;

    switch (outcome) {
      case 'Win': category.roundWin++; break;
      case 'Loss': category.roundLoss++; break;
      case 'Tie': category.roundTie++; break;
    }

    category.roundCount++;
    category.totalScore += total;

    throws.forEach(({ clutch, score }) => {
      if (clutch) {
        category.clutch.call++;
        category.clutch.hit += score === 7 ? 1 : 0;
        category.clutch.totalScore += score;
      } else {
        switch (score) {
          case 5: category.target.five++; break;
          case 3: category.target.three++; break;
          case 1: category.target.one++; break;
          case 0: category.target.drop++; break;
        }

        category.target.totalScore += score;
        category.target.throwCount++;
      }
    });
  });

  return stats;
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