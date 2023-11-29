const puppeteer = require('puppeteer');

const config = require('../config');
const { db, sequentially, isDesiredResponse, reactPageState, waitMilliseconds, roundForDisplay, median, logError } = require('../helpers');

const getProfiles = async (page) => {
  const rulesetValue = 'IATF Premier';
  const rulesetSelector = `select:has(> option[value="${rulesetValue}"])`;

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, rulesetValue);
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const allProfiles = state.globalStandings.standings.career;

  return allProfiles.filter(x => x.active);
};

const processProfile = async (page, { id: profileId, rank, rating }) => {
  console.log(`Scraping profile data for profile ID ${profileId}`);

  await page.goto(`https://axescores.com/player/${profileId}`);
  await waitMilliseconds(1000);

  const image = await getProfileImage(profileId);
  const state = await reactPageState(page, '#root');
  const { name, about, leagues } = state.player.playerData;
  const seasons = leagues.filter(x => x.performanceName === 'IATF Premier');

  db.run(`
    INSERT OR IGNORE INTO profiles (profileId)
    VALUES (?)
  `, [profileId]);

  db.run(`
    UPDATE profiles
    SET name = ?, about = ?, rank = ?, rating = ?, image = ?
    WHERE profileId = ?
  `, [name, about, rank, rating, image, profileId]);

  seasons.forEach(({ id: seasonId, date, name, shortName, seasonRank, playoffRank, seasonWeeks }) => {
    db.run(`
      INSERT OR IGNORE INTO seasons (seasonId, profileId)
      VALUES (?, ?)
    `, [seasonId, profileId]);

    db.run(`
      UPDATE seasons
      SET name = ?, shortName = ?, date = ?, seasonRank = ?, playoffRank = ?
      WHERE seasonId = ? AND profileId = ?
    `, [
      name,
      shortName,
      date,
      seasonRank || 0,
      playoffRank || 0,
      seasonId,
      profileId
    ]);

    seasonWeeks.forEach(({ week, matches }) => {
      matches.forEach(({ id: matchId, result }) => {
        if (result) {
          db.run(`
            INSERT OR IGNORE INTO matches (matchId, profileId, seasonId, week)
            VALUES (?, ?, ?, ?)
          `, [matchId, profileId, seasonId, week]);
        }
      });
    });
  });
};

const getProfileImage = async (profileId) => {
  console.log(`Scraping profile image for profile ID ${profileId}`);

  const url = `https://admin.axescores.com/pic/${profileId}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return base64;
};

const getMatches = () => {
  let matchIds = new Set(), profileIds = new Set();

  const unprocessedMatches = db.rows(`
    SELECT profileId, matchId
    FROM matches
    WHERE state = ?
  `, [db.enums.matchState.unprocessed]);

  const reprocessMatches = config.reprocessMatchIds.length < 1 ? [] : db.rows(`
    SELECT profileId, matchId
    FROM matches
    WHERE matchId IN (${config.reprocessMatchIds.map(() => '?').join(', ')})
  `, config.reprocessMatchIds);

  reprocessMatches.concat(unprocessedMatches).forEach(({ matchId, profileId }) => {
    matchIds.add(matchId);
    profileIds.add(profileId);
  });

  return { matchIds, profileIds };
};

const processMatch = async (page, matchId, profileIds) => {
  const url = `https://axescores.com/player/1/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;

  const [apiResponse] = await Promise.all([
    page.waitForResponse(isDesiredResponse('GET', 200, apiUrl), { timeout: 2000 }),
    page.goto(url)
  ]);

  const rawMatch = await apiResponse.json();
  const players = rawMatch.players.filter(x => profileIds.has(x.id));

  players.forEach(({ id: profileId }) => {
    console.log(`Processing match details for match ID ${matchId} profile ID ${profileId}`);

    const { opponentId, state, outcome, total, rounds } = mapMatch(profileId, rawMatch);

    db.run(`
      UPDATE matches
      SET opponentId = ?, state = ?, outcome = ?, total = ?, rounds = ?, stats = ?
      WHERE matchId = ? AND profileId = ?
    `, [
      opponentId,
      state,
      outcome,
      total,
      JSON.stringify(rounds),
      JSON.stringify(analyzeMatch(rounds)),
      matchId,
      profileId
    ]);
  });
};

const mapMatch = (profileId, rawMatch) => {
  const match = {
    matchId: rawMatch.id,
    profileId,
    opponentId: rawMatch.players.find(x => x.id !== profileId)?.id || 0,
    state: db.enums.matchState.unprocessed,
    outcome: '',
    total: 0,
    rounds: []
  };

  const invalidRoundCount = rawMatch.rounds.length > 4;
  const forfeit = rawMatch.players.find(x => x.id === profileId)?.forfeit === true;
  const states = db.enums.matchState;

  match.state = invalidRoundCount ? states.invalid : forfeit ? states.forfeit : states.valid;

  if (invalidRoundCount) {
    return match;
  }

  let roundWins = 0, roundLosses = 0, bigAxeWins = 0, bigAxeLosses = 0;

  rawMatch.rounds.forEach((rawRound) => {
    const opponent = rawRound.games.find(x => x.player !== profileId);
    const { score: total, Axes: throws } = rawRound.games.find(x => x.player === profileId);
    const round = {
      outcome: '',
      total,
      throws: throws.map(({ score, clutchCalled: clutch }) => ({ score, clutch })),
      bigAxe: rawRound.name === 'Tie Break'
    };

    switch (true) {
      case total  >  opponent.score: round.outcome = 'Win'; break;
      case total  <  opponent.score: round.outcome = 'Loss'; break;
      case total === opponent.score: round.outcome = 'Tie'; break;
    }

    match.total += round.bigAxe ? 0 : total;

    switch (true) {
      case round.bigAxe && round.outcome === 'Win': bigAxeWins++; break;
      case round.bigAxe && round.outcome === 'Loss': bigAxeLosses++; break;
      case !round.bigAxe && round.outcome === 'Win': roundWins++; break;
      case !round.bigAxe && round.outcome === 'Loss': roundLosses++; break;
    }

    match.rounds.push(round);
  });

  switch (true) {
    case roundWins > roundLosses:   match.outcome = 'Win'; break;
    case bigAxeWins > bigAxeLosses: match.outcome = 'Win'; break;
    case roundLosses > roundWins:   match.outcome = 'Loss'; break;
    case bigAxeLosses > bigAxeWins: match.outcome = 'OTL'; break;
  }

  return match;
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

const analyzeProfile = (profileId) => {
  console.log(`Analyzing profile ID ${profileId}`);

  const profile = db.row(`
    SELECT *
    FROM profiles
    WHERE profileId = ?
  `, [profileId]);

  const matches = db.rows(`
    SELECT *
    FROM matches
    WHERE profileId = ? AND state = ?
  `, [profileId, db.enums.matchState.valid]);

  matches.forEach(x => {
    x.rounds = JSON.parse(x.rounds);
    x.stats = JSON.parse(x.stats);
  });

  const seasons = db.rows(`
    SELECT *
    FROM seasons
    WHERE profileId = ?
  `, [profileId]);

  seasons.forEach(x => {
    const seasonMatches = matches.filter(y => y.seasonId === x.seasonId);

    x.stats = aggregateMatchStats(seasonMatches);

    db.run(`
      UPDATE seasons
      SET stats = ?
      WHERE profileId = ? AND seasonId = ?
    `, [
      JSON.stringify(x.stats),
      profileId,
      x.seasonId
    ]);
  });

  profile.matches = matches;
  profile.seasons = seasons;
  profile.stats = aggregateMatchStats(matches);

  db.run(`
    UPDATE profiles
    SET stats = ?
    WHERE profileId = ?
  `, [
    JSON.stringify(profile.stats),
    profileId
  ]);
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
    acr: {
      pointsEarned: 0,
      pointsAvailable: 0,
      rating: 0,
    }
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

  stats.acr = getAxeChartsRating(stats.hatchet, stats.bigAxe);

  return stats;
};

const getAxeChartsRating = (hatchet, bigAxe) => {
  const multiplier = 10 ** 3;
  const pointsEarned = hatchet.totalScore + bigAxe.totalScore;
  const bullAttempts = hatchet.target.throwCount + bigAxe.target.throwCount;
  const clutchAttempts = hatchet.clutch.call + bigAxe.clutch.call;
  const pointsAvailable = 5 * (bullAttempts + clutchAttempts); // (5 * bullAttempts) + (7 * clutchAttempts);
  const rating = Math.round(multiplier * pointsEarned / pointsAvailable);

  return {
    pointsEarned,
    pointsAvailable,
    rating,
  };
};

(async () => {
  try {
    console.log('Config: ', JSON.stringify(config, null, 2));

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log('********** Getting profiles **********');

    const profiles = await getProfiles(page);

    console.log(`Found ${profiles.length} profiles.`);

    await sequentially(profiles, async (profile) => processProfile(page, profile).catch(logError));

    console.log('********** Getting matches **********');

    const { matchIds, profileIds } = getMatches(page);
    const matchIdsArray = [...matchIds];

    console.log(`Found ${matchIdsArray.length} new matches.`);

    // await sequentially([...matchIds], async (matchId) => processMatch(page, matchId, profileIds).catch(logError));
    console.log('Skipping match processing for now.');

    console.log('********** Analyzing Profiles **********');

    // [...profileIds].forEach((profileId) => analyzeProfile(profileId));
    console.log('Skipping profile analysis for now.');

    await browser.close();

    db.run(`VACUUM`);
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();