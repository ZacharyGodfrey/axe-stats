const path = require('path');
const fs = require('fs-extra');
const { render } = require('mustache');

const config = require('../config');
const { db, median, roundForDisplay, logError } = require('../helpers');

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

const buildHomePage = (shell, profiles) => {
  const page = readFile(`${CLIENT_DIR}/home.html`);
  const data = {
    title: undefined,
    profiles,
    dataJson: JSON.stringify({ profiles })
  };

  return render(shell, data, { page });
};

const build404Page = (shell) => {
  const page = readFile(`${CLIENT_DIR}/404.html`);
  const data = {
    title: 'Not Found'
  };

  return render(shell, data, { page });
};

const build500Page = (shell) => {
  const page = readFile(`${CLIENT_DIR}/500.html`);
  const data = {
    title: 'Error',
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

const aggregateMatchStats = (matches) => {
  const stats = {
    match: {
      win: 0,
      winPercent: 0,
      loss: 0,
      lossPercent: 0,
      otl: 0,
      otlPercent: 0,
      winWithoutBigAxe: 0,
      winWithoutBigAxePercent: 0,
      count: matches.length,
      totalScore: 0,
      averageScore: 0,
      minScore: 0,
      medianScore: 0,
      maxScore: 0,
    },
    hatchet: {
      roundWin: 0,
      roundWinPercent: 0,
      roundLoss: 0,
      roundLossPercent: 0,
      roundTie: 0,
      roundTiePercent: 0,
      roundCount: 0,
      totalScore: 0,
      throwCount: 0,
      scorePerThrow: 0,
      clutch: {
        call: 0,
        callPercent: 0,
        hit: 0,
        hitPercent: 0,
        totalScore: 0,
        ev: 0,
      },
      target: {
        five: 0,
        three: 0,
        one: 0,
        drop: 0,
        fivePercent: 0,
        threePercent: 0,
        onePercent: 0,
        dropPercent: 0,
        totalScore: 0,
        throwCount: 0,
        ev: 0,
      }
    },
    bigAxe: {
      roundWin: 0,
      roundWinPercent: 0,
      roundLoss: 0,
      roundLossPercent: 0,
      roundCount: 0,
      totalScore: 0,
      throwCount: 0,
      scorePerThrow: 0,
      clutch: {
        call: 0,
        hit: 0,
        hitPercent: 0,
        totalScore: 0,
        ev: 0,
      },
      target: {
        five: 0,
        three: 0,
        one: 0,
        drop: 0,
        fivePercent: 0,
        threePercent: 0,
        onePercent: 0,
        dropPercent: 0,
        totalScore: 0,
        throwCount: 0,
        ev: 0,
      }
    },
  };

  let allScores = [];

  matches.forEach((match) => {
    allScores.push(match.total);

    stats.match.win += match.outcome === 'Win' ? 1 : 0;
    stats.match.loss += match.outcome === 'Loss' ? 1 : 0;
    stats.match.otl += match.outcome === 'OTL' ? 1 : 0;
    stats.match.winWithoutBigAxe += match.outcome === 'Win' && match.stats.bigAxe.roundCount === 0 ? 1 : 0;
    stats.match.totalScore += match.total;

    stats.hatchet.roundWin += match.stats.hatchet.roundWin;
    stats.hatchet.roundLoss += match.stats.hatchet.roundLoss;
    stats.hatchet.roundTie += match.stats.hatchet.roundTie;
    stats.hatchet.roundCount += match.stats.hatchet.roundCount;
    stats.hatchet.totalScore += match.stats.hatchet.totalScore;
    stats.hatchet.throwCount += match.stats.hatchet.clutch.call + match.stats.hatchet.target.throwCount;

    stats.hatchet.clutch.call += match.stats.hatchet.clutch.call;
    stats.hatchet.clutch.hit += match.stats.hatchet.clutch.hit;
    stats.hatchet.clutch.totalScore += match.stats.hatchet.clutch.totalScore;

    stats.hatchet.target.five += match.stats.hatchet.target.five;
    stats.hatchet.target.three += match.stats.hatchet.target.three;
    stats.hatchet.target.one += match.stats.hatchet.target.one;
    stats.hatchet.target.drop += match.stats.hatchet.target.drop;
    stats.hatchet.target.totalScore += match.stats.hatchet.target.totalScore;
    stats.hatchet.target.throwCount += match.stats.hatchet.target.throwCount;

    stats.bigAxe.roundWin += match.stats.bigAxe.roundWin;
    stats.bigAxe.roundLoss += match.stats.bigAxe.roundLoss;
    stats.bigAxe.roundCount += match.stats.bigAxe.roundCount;
    stats.bigAxe.totalScore += match.stats.bigAxe.totalScore;
    stats.bigAxe.throwCount += match.stats.bigAxe.clutch.call + match.stats.bigAxe.target.throwCount;

    stats.bigAxe.clutch.call += match.stats.bigAxe.clutch.call;
    stats.bigAxe.clutch.hit += match.stats.bigAxe.clutch.hit;
    stats.bigAxe.clutch.totalScore += match.stats.bigAxe.clutch.totalScore;

    stats.bigAxe.target.five += match.stats.bigAxe.target.five;
    stats.bigAxe.target.three += match.stats.bigAxe.target.three;
    stats.bigAxe.target.one += match.stats.bigAxe.target.one;
    stats.bigAxe.target.drop += match.stats.bigAxe.target.drop;
    stats.bigAxe.target.totalScore += match.stats.bigAxe.target.totalScore;
    stats.bigAxe.target.throwCount += match.stats.bigAxe.target.throwCount;
  });

  stats.match.winPercent = roundForDisplay(100 * stats.match.win / stats.match.count);
  stats.match.lossPercent = roundForDisplay(100 * stats.match.loss / stats.match.count);
  stats.match.otlPercent = roundForDisplay(100 * stats.match.otl / stats.match.count);
  stats.match.winWithoutBigAxePercent = roundForDisplay(100 * stats.match.winWithoutBigAxe / stats.match.count);
  stats.match.averageScore = roundForDisplay(stats.match.totalScore / stats.match.count);
  stats.match.minScore = Math.min(...allScores);
  stats.match.medianScore = roundForDisplay(median(allScores) || 0);
  stats.match.maxScore = Math.max(...allScores);

  stats.hatchet.roundWinPercent = roundForDisplay(100 * stats.hatchet.roundWin / stats.hatchet.roundCount);
  stats.hatchet.roundLossPercent = roundForDisplay(100 * stats.hatchet.roundLoss / stats.hatchet.roundCount);
  stats.hatchet.roundTiePercent = roundForDisplay(100 * stats.hatchet.roundTie / stats.hatchet.roundCount);
  stats.hatchet.scorePerThrow = roundForDisplay(stats.hatchet.totalScore / stats.hatchet.throwCount);
  stats.hatchet.clutch.callPercent = roundForDisplay(100 * stats.hatchet.clutch.call / stats.hatchet.roundCount);
  stats.hatchet.clutch.hitPercent = roundForDisplay(100 * stats.hatchet.clutch.hit / stats.hatchet.clutch.call);
  stats.hatchet.clutch.ev = roundForDisplay(stats.hatchet.clutch.totalScore / stats.hatchet.clutch.call);
  stats.hatchet.target.fivePercent = roundForDisplay(100 * stats.hatchet.target.five / stats.hatchet.target.throwCount);
  stats.hatchet.target.threePercent = roundForDisplay(100 * stats.hatchet.target.three / stats.hatchet.target.throwCount);
  stats.hatchet.target.onePercent = roundForDisplay(100 * stats.hatchet.target.one / stats.hatchet.target.throwCount);
  stats.hatchet.target.dropPercent = roundForDisplay(100 * stats.hatchet.target.drop / stats.hatchet.target.throwCount);
  stats.hatchet.target.ev = roundForDisplay(stats.hatchet.target.totalScore / stats.hatchet.target.throwCount);

  stats.bigAxe.roundWinPercent = roundForDisplay(100 * stats.bigAxe.roundWin / stats.bigAxe.roundCount);
  stats.bigAxe.roundLossPercent = roundForDisplay(100 * stats.bigAxe.roundLoss / stats.bigAxe.roundCount);
  stats.bigAxe.scorePerThrow = roundForDisplay(stats.bigAxe.totalScore / stats.bigAxe.throwCount);
  stats.bigAxe.clutch.hitPercent = roundForDisplay(100 * stats.bigAxe.clutch.hit / stats.bigAxe.clutch.call);
  stats.bigAxe.clutch.ev = roundForDisplay(stats.bigAxe.clutch.totalScore / stats.bigAxe.clutch.call);
  stats.bigAxe.target.fivePercent = roundForDisplay(100 * stats.bigAxe.target.five / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.threePercent = roundForDisplay(100 * stats.bigAxe.target.three / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.onePercent = roundForDisplay(100 * stats.bigAxe.target.one / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.dropPercent = roundForDisplay(100 * stats.bigAxe.target.drop / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.ev = roundForDisplay(stats.bigAxe.target.totalScore / stats.bigAxe.target.throwCount);

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

    writeFile(`${DIST_DIR}/404.html`, build404Page(shell));
    writeFile(`${DIST_DIR}/500.html`, build500Page(shell));
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
        x.stats = null;
      });

      const validMatches = matches.filter(x => x.state === db.enums.matchState.valid);

      validMatches.forEach(x => {
        x.stats = analyzeMatch(x.rounds);
        x.opponent = db.row(`
          SELECT profileId, name, image
          FROM profiles
          WHERE profileId = ?
        `, [x.opponentId]) || null;
      });

      profile.seasons = seasons.map((x, i) => ({ ...x, order: i + 1 })).reverse();
      profile.stats = aggregateMatchStats(validMatches);
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