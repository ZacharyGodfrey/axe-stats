const puppeteer = require('puppeteer');

const config = require('../config.json');
const { db, sequentially, isDesiredResponse, reactPageState, waitMilliseconds, sum, round, logError } = require('./helpers');

const timeout = 2 * 1000; // 2 seconds

const getProfiles = async (page, profileIds) => {
  console.log('# Get Profiles');

  const profileIdSet = new Set(profileIds);
  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  console.log('Scraping all profile data...');

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const allProfiles = state.globalStandings.standings.career;
  const profiles = allProfiles.filter(x => profileIdSet.has(x.id));

  await sequentially(profiles, async (profile) => processProfile(page, profile).catch(logError));
};

const processProfile = async (page, { id, rank, rating }) => {
  console.log(`Scraping additional profile data for ID ${id}...`);

  await page.goto(`https://axescores.com/player/${id}`);
  await waitMilliseconds(timeout);

  const image = await getProfileImage(id);
  const state = await reactPageState(page, '#root');
  const { name, about, leagues } = state.player.playerData;

  await db.run(`
    INSERT OR IGNORE INTO profiles
    (id) VALUES (?)
  `, [id]);

  await db.run(`
    UPDATE profiles
    SET name = ?, about = ?, rank = ?, rating = ?, image = ?
    WHERE id = ?
  `, [name, about, rank, rating, image, id]);

  const premierLeagues = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = premierLeagues.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  await db.run(`
    INSERT OR IGNORE INTO matches
    (profileId, id) VALUES ${matches.map(x => `(${id}, ${x.id})`).join(', ')}
  `);
};

const getProfileImage = async (id) => {
  const url = `https://admin.axescores.com/pic/${id}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return base64;
};

const getMatches = async (page) => {
  console.log('# Get Matches');

  let profileIds = new Set(), matchIds = new Set();

  const unprocessedMatches = await db.query(`
    SELECT profileId, id
    FROM matches
    WHERE processed = 0
  `);

  unprocessedMatches.forEach(({ profileId, id }) => {
    profileIds.add(profileId);
    matchIds.add(id);
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

  await sequentially(players, async ({ id: profileId }) => {
    console.log(`Processing match details for match ID ${matchId} profile ID ${profileId}`);

    const forfeit = rawMatch.players.find(x => x.id === profileId)?.forfeit === true;
    const invalidRoundCount = rawMatch.rounds.length > 4;

    if (forfeit || invalidRoundCount) {
      await db.run(`
        UPDATE matches
        SET processed = 1, valid = 0
        WHERE profileId = ? AND id = ?
      `, [profileId, matchId]);

      return;
    }

    const stats = matchStats(rawMatch, profileId);

    await db.run(`
      UPDATE matches
      SET processed = 1, valid = 1, stats = ?
      WHERE profileId = ? AND id = ?
    `, [JSON.stringify(stats), profileId, matchId]);
  });
};

const matchStats = (rawMatch, profileId) => {
  const stats = {
    win: false,
    loss: false,
    otl: false,
    totalScore: 0,
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

  rawMatch.rounds.forEach((round) => {
    const isBigAxe = round.name === 'Tie Break';
    const category = isBigAxe ? stats.bigAxe : stats.hatchet;
    const opponent = round.games.find(x => x.player !== profileId);
    const { score: total, Axes: throws } = round.games.find(x => x.player === profileId);

    stats.totalScore += isBigAxe ? 0 : total;
    category.roundCount++;
    category.totalScore += total;

    switch (true) {
      case total > opponent.score: category.roundWin++; break;
      case total < opponent.score: category.roundLoss++; break;
      default: category.roundTie++; break;
    }

    throws.forEach(({ score, clutchCalled }) => {
      if (clutchCalled) {
        category.clutch.call++;
        category.clutch.totalScore += score;
        category.clutch.hit += score === 7 ? 1 : 0;
      } else {
        category.target.throwCount++;
        category.target.totalScore += score;

        switch (score) {
          case 5: category.target.five++; break;
          case 3: category.target.three++; break;
          case 1: category.target.one++; break;
          case 0: category.target.drop++; break;
        }
      }
    });
  });

  stats.loss = stats.hatchet.roundWin < stats.hatchet.roundLoss;
  stats.otl = stats.bigAxe.roundWin < stats.bigAxe.roundLoss;
  stats.win = !(stats.loss || stats.otl);

  return stats;
};

const aggregateMatchStats = (matches) => {
  const stats = {
    match: {
      win: 0,
      loss: 0,
      otl: 0,
      count: matches.length,
      totalScore: 0,
      averageScore: 0,
      winPercent: 0,
    },
    hatchet: {
      roundWin: 0,
      roundLoss: 0,
      roundTie: 0,
      roundCount: 0,
      winPercent: 0,
      totalScore: 0,
      throwCount: 0,
      scorePerThrow: 0,
      clutch: {
        call: 0,
        hit: 0,
        totalScore: 0,
        callPercent: 0,
        hitPercent: 0,
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
      roundLoss: 0,
      roundCount: 0,
      winPercent: 0,
      totalScore: 0,
      throwCount: 0,
      scorePerThrow: 0,
      clutch: {
        call: 0,
        hit: 0,
        totalScore: 0,
        hitPercent: 0,
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
    stats.match.win += match.win ? 1 : 0;
    stats.match.loss += match.loss ? 1 : 0;
    stats.match.otl += match.otl ? 1 : 0;
    stats.match.totalScore += match.totalScore;

    stats.hatchet.roundWin += match.hatchet.roundWin;
    stats.hatchet.roundLoss += match.hatchet.roundLoss;
    stats.hatchet.roundTie += match.hatchet.roundTie;
    stats.hatchet.roundCount += match.hatchet.roundCount;
    stats.hatchet.totalScore += match.hatchet.totalScore;
    stats.hatchet.throwCount += match.hatchet.clutch.call + match.hatchet.target.throwCount;

    stats.hatchet.clutch.call += match.hatchet.clutch.call;
    stats.hatchet.clutch.hit += match.hatchet.clutch.hit;
    stats.hatchet.clutch.totalScore += match.hatchet.clutch.totalScore;

    stats.hatchet.target.five += match.hatchet.target.five;
    stats.hatchet.target.three += match.hatchet.target.three;
    stats.hatchet.target.one += match.hatchet.target.one;
    stats.hatchet.target.drop += match.hatchet.target.drop;
    stats.hatchet.target.totalScore += match.hatchet.target.totalScore;

    stats.bigAxe.roundWin += match.bigAxe.roundWin;
    stats.bigAxe.roundLoss += match.bigAxe.roundLoss;
    stats.bigAxe.roundCount += match.bigAxe.roundCount;
    stats.bigAxe.totalScore += match.bigAxe.totalScore;
    stats.bigAxe.throwCount += match.bigAxe.clutch.call + match.bigAxe.target.throwCount;

    stats.bigAxe.clutch.call += match.bigAxe.clutch.call;
    stats.bigAxe.clutch.hit += match.bigAxe.clutch.hit;
    stats.bigAxe.clutch.totalScore += match.bigAxe.clutch.totalScore;

    stats.bigAxe.target.five += match.bigAxe.target.five;
    stats.bigAxe.target.three += match.bigAxe.target.three;
    stats.bigAxe.target.one += match.bigAxe.target.one;
    stats.bigAxe.target.drop += match.bigAxe.target.drop;
    stats.bigAxe.target.totalScore += match.bigAxe.target.totalScore;
  });

  stats.match.averageScore = roundForDisplay(stats.match.totalScore / stats.match.count);
  stats.match.winPercent = roundForDisplay(100 * stats.match.win / stats.match.count);

  stats.hatchet.winPercent = roundForDisplay(100 * stats.hatchet.roundWin / stats.hatchet.roundCount);
  stats.hatchet.scorePerThrow = roundForDisplay(stats.hatchet.totalScore / stats.hatchet.throwCount);
  stats.hatchet.clutch.callPercent = roundForDisplay(100 * stats.hatchet.clutch.call / stats.hatchet.roundCount);
  stats.hatchet.clutch.hitPercent = roundForDisplay(100 * stats.hatchet.clutch.hit / stats.hatchet.clutch.call);
  stats.hatchet.clutch.ev = roundForDisplay(stats.hatchet.clutch.totalScore / stats.hatchet.clutch.call);
  stats.hatchet.target.fivePercent = roundForDisplay(100 * stats.hatchet.target.five / stats.hatchet.target.throwCount);
  stats.hatchet.target.threePercent = roundForDisplay(100 * stats.hatchet.target.three / stats.hatchet.target.throwCount);
  stats.hatchet.target.onePercent = roundForDisplay(100 * stats.hatchet.target.one / stats.hatchet.target.throwCount);
  stats.hatchet.target.dropPercent = roundForDisplay(100 * stats.hatchet.target.drop / stats.hatchet.target.throwCount);
  stats.hatchet.target.ev = roundForDisplay(stats.hatchet.target.totalScore / stats.hatchet.target.throwCount);

  stats.bigAxe.winPercent = roundForDisplay(100 * stats.bigAxe.roundWin / stats.bigAxe.roundCount);
  stats.bigAxe.scorePerThrow = roundForDisplay(stats.bigAxe.totalScore / stats.bigAxe.throwCount);
  stats.bigAxe.clutch.callPercent = roundForDisplay(100 * stats.bigAxe.clutch.call / stats.bigAxe.roundCount);
  stats.bigAxe.clutch.hitPercent = roundForDisplay(100 * stats.bigAxe.clutch.hit / stats.bigAxe.clutch.call);
  stats.bigAxe.clutch.ev = roundForDisplay(stats.bigAxe.clutch.totalScore / stats.bigAxe.clutch.call);
  stats.bigAxe.target.fivePercent = roundForDisplay(100 * stats.bigAxe.target.five / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.threePercent = roundForDisplay(100 * stats.bigAxe.target.three / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.onePercent = roundForDisplay(100 * stats.bigAxe.target.one / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.dropPercent = roundForDisplay(100 * stats.bigAxe.target.drop / stats.bigAxe.target.throwCount);
  stats.bigAxe.target.ev = roundForDisplay(stats.bigAxe.target.totalScore / stats.bigAxe.target.throwCount);

  return stats;
};

const roundForDisplay = (value) => isNaN(value) ? 0 : round(value, 2);

const updateProfileStats = async () => {
  const profiles = await db.query(`
    SELECT *
    FROM profiles
    ORDER BY rank ASC, rating DESC;
  `);

  await sequentially(profiles, async (profile) => {
    const matches = await db.query(`
      SELECT stats
      FROM matches
      WHERE processed = 1 AND valid = 1
      ORDER BY id asc;
    `);

    const stats = aggregateMatchStats(matches.map(x => JSON.parse(x.stats)));

    await db.run(`
      UPDATE profiles
      SET stats = ?
      WHERE id = ?
    `, [
      JSON.stringify(stats),
      profile.id
    ]);
  });

  return data;
};

(async () => {
  try {
    console.log('Config: ', JSON.stringify(config, null, 2));

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await db.connect();

    await getProfiles(page, config.profileIds);
    await getMatches(page);

    await browser.close();

    await updateProfileStats();

    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();