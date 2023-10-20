const puppeteer = require('puppeteer');

const config = require('../config.json');
const { db, sequentially, isDesiredResponse, reactPageState, waitMilliseconds, roundForDisplay, logError } = require('./helpers');

const timeout = 2 * 1000; // 2 seconds

const getProfiles = async (page, profileIds) => {
  const profileIdSet = new Set(profileIds);
  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const allProfiles = state.globalStandings.standings.career;
  const profiles = allProfiles.filter(x => profileIdSet.has(x.id));

  await sequentially(profiles, async (profile) => processProfile(page, profile).catch(logError));
};

const processProfile = async (page, { id: profileId, rank, rating }) => {
  console.log(`Scraping profile data for profile ID ${profileId}`);

  await page.goto(`https://axescores.com/player/${profileId}`);
  await waitMilliseconds(timeout);

  const image = await getProfileImage(profileId);
  const state = await reactPageState(page, '#root');
  const { name, about, leagues } = state.player.playerData;

  db.run(`
    INSERT OR IGNORE INTO profiles
    (profileId) VALUES (?)
  `, [profileId]);

  db.run(`
    UPDATE profiles
    SET name = ?, about = ?, rank = ?, rating = ?, image = ?
    WHERE profileId = ?
  `, [name, about, rank, rating, image, profileId]);

  const premierLeagues = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = premierLeagues.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  db.run(`
    INSERT OR IGNORE INTO matches
    (matchId, profileId) VALUES ${matches.map(match => `(${match.id}, ${profileId})`).join(', ')}
  `);
};

const getProfileImage = async (profileId) => {
  console.log(`Scraping profile image for profile ID ${profileId}`);

  const url = `https://admin.axescores.com/pic/${profileId}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return base64;
};

const getMatches = async (page) => {
  let profileIds = new Set(), matchIds = new Set();

  const unprocessedMatches = db.rows(`
    SELECT profileId, matchId
    FROM matches
    WHERE state = ?
  `, [db.enums.matchState.unprocessed]);

  unprocessedMatches.forEach(({ profileId, matchId }) => {
    profileIds.add(profileId);
    matchIds.add(matchId);
  });

  await sequentially([...matchIds], async (matchId) => processMatch(page, matchId, profileIds).catch(logError));
};

const processMatch = async (page, matchId, profileIds) => {
  const url = `https://axescores.com/player/1/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;

  const [apiResponse] = await Promise.all([
    page.waitForResponse(isDesiredResponse('GET', 200, apiUrl), { timeout }),
    page.goto(url)
  ]);

  const rawMatch = await apiResponse.json();
  const players = rawMatch.players.filter(x => profileIds.has(x.id));

  players.forEach(({ id: profileId }) => {
    console.log(`Processing match details for match ID ${matchId} profile ID ${profileId}`);

    const match = mapMatch(profileId, rawMatch);
    const stats = match.outcome === '' ? {} : analyzeMatch(match);

    db.run(`
      UPDATE matches
      SET state = ?, outcome = ?, total = ?, text = ?, stats = ?
      WHERE matchId = ? AND profileId = ?
    `, [
      match.state,
      match.outcome,
      match.total,
      matchText(match),
      JSON.stringify(stats),
      matchId,
      profileId
    ]);
  });
};

const mapMatch = (profileId, rawMatch) => {
  const match = {
    matchId: rawMatch.id,
    profileId,
    state: db.enums.matchState.unprocessed,
    outcome: '',
    total: 0,
    rounds: [],
    bigAxe: null
  };

  const invalidRoundCount = rawMatch.rounds.length > 4;
  const forfeit = rawMatch.players.find(x => x.id === profileId)?.forfeit === true;
  const states = db.enums.matchState;

  match.state = invalidRoundCount ? states.invalid : forfeit ? states.forfeit : states.valid;

  if (invalidRoundCount) {
    return match;
  }

  let roundWins = 0, roundLosses = 0;

  rawMatch.rounds.forEach((rawRound) => {
    const opponent = rawRound.games.find(x => x.player !== profileId);
    const { score: total, Axes: throws } = rawRound.games.find(x => x.player === profileId);
    const round = {
      outcome: '',
      total,
      throws: throws.map(({ score, clutchCalled: clutch }) => ({ score, clutch }))
    };

    switch (true) {
      case total  >  opponent.score: round.outcome = 'W'; break;
      case total  <  opponent.score: round.outcome = 'L'; break;
      case total === opponent.score: round.outcome = 'T'; break;
    }

    if (round.name === 'Tie Break') {
      match.bigAxe = round;
    } else {
      match.rounds.push(round);
      match.total += total;

      switch (round.outcome) {
        case 'W': roundWins++; break;
        case 'L': roundLosses++; break;
      }
    }
  });

  switch (true) {
    case roundWins > roundLosses:       match.outcome = 'W'; break;
    case match.bigAxe?.outcome === 'W': match.outcome = 'W'; break;
    case roundLosses > roundWins:       match.outcome = 'L'; break;
    case match.bigAxe?.outcome === 'L': match.outcome = 'O'; break;
  }

  return match;
};

const matchText = ({ matchId, profileId, state, outcome, total, rounds, bigAxe }) => {
  const parts = [matchId, profileId, state];

  switch (state) {
    case db.enums.matchState.invalid: parts.push('I'); break;
    case db.enums.matchState.forfeit: parts.push('F'); break;
    case db.enums.matchState.valid: parts.push(outcome); break;
  }

  if (state !== db.enums.matchState.valid) {
    return parts.join(' ');
  }

  parts.push(total);

  rounds.concat(bigAxe || []).forEach(({ outcome, throws }) => {
    parts.push(...[
      outcome,
      throws.map(({ score, clutch }) => score === 0 && clutch ? 'C' : score).join('')
    ]);
  });

  return parts.join(' ');
};

const analyzeMatch = ({ rounds, bigAxe }) => {
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

  const allRounds = rounds.map(x => ({ ...x, bigAxe: false })).concat(bigAxe ? { ...bigAxe, bigAxe: true } : []);

  allRounds.forEach(({ bigAxe, outcome, total, throws }) => {
    const category = bigAxe ? stats.bigAxe : stats.hatchet;

    switch (outcome) {
      case 'W': category.roundWin++; break;
      case 'L': category.roundLoss++; break;
      case 'T': category.roundTie++; break;
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

const updateProfileStats = () => {
  const profiles = db.rows(`
    SELECT profileId
    FROM profiles
  `);

  profiles.forEach(({ profileId }) => {
    console.log(`Updating profile stats for profile ID ${profileId}`);

    const matches = db.rows(`
      SELECT *
      FROM matches
      WHERE profileId = ? AND state = ?
    `, [profileId, db.enums.matchState.valid]);

    matches.forEach(x => x.stats = JSON.parse(x.stats));

    const stats = aggregateMatchStats(matches);

    db.run(`
      UPDATE profiles
      SET stats = ?
      WHERE profileId = ?
    `, [JSON.stringify(stats), profileId]);
  });
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

  matches.forEach((match) => {
    stats.match.win += match.outcome === 'W' ? 1 : 0;
    stats.match.loss += match.outcome === 'L' ? 1 : 0;
    stats.match.otl += match.outcome === 'O' ? 1 : 0;
    stats.match.winWithoutBigAxe += match.outcome === 'W' && match.stats.bigAxe.roundCount === 0 ? 1 : 0;
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

(async () => {
  try {
    console.log('Config: ', JSON.stringify(config, null, 2));

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log([
      '**********',
      'Getting profiles',
      '**********'
    ].join('\n'));

    await getProfiles(page, config.profileIds);

    console.log([
      '**********',
      'Getting matches',
      '**********'
    ].join('\n'));

    await getMatches(page);

    await browser.close();

    console.log([
      '**********',
      'Updating profile stats',
      '**********'
    ].join('\n'));

    updateProfileStats();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();