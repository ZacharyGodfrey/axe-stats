const puppeteer = require('puppeteer');

const { db, sequentially, reactPageState, logError } = require('../helpers');

const isDesiredResponse = (method, status, url) => {
  return (response) => {
    return response.request().method() === method
      && response.status() === status
      && response.url() === url;
  };
};

const matchStats = (rawMatch, profileId) => {
  let matchScore = 0;

  const hatchet = {
    win: 0,
    loss: 0,
    tie: 0,
    clutchCall: 0,
    clutchHit: 0,
    five: 0,
    three: 0,
    one: 0,
    drop: 0,
  };

  const bigAxe = {
    win: 0,
    loss: 0,
    clutchCall: 0,
    clutchHit: 0,
    five: 0,
    three: 0,
    one: 0,
    drop: 0,
  };

  rawMatch.rounds.forEach((round) => {
    const isBigAxe = round.name === 'Tie Break';
    const category = isBigAxe ? bigAxe : hatchet;
    const opponent = round.games.find(x => x.player !== profileId);
    const { score: total, Axes: throws } = round.games.find(x => x.player === profileId);

    matchScore += isBigAxe ? 0 : total;

    switch (true) {
      case total > opponent.score: category.win++; break;
      case total < opponent.score: category.loss++; break;
      default: category.tie++; break;
    }

    throws.forEach(({ score, clutchCalled }) => {
      if (clutchCalled) {
        category.clutchCall++;
        category.clutchHit += score === 7 ? 1 : 0;
      } else {
        switch (score) {
          case 5: category.five++; break;
          case 3: category.three++; break;
          case 1: category.one++; break;
          case 0: category.drop++; break;
        }
      }
    });
  });

  const isLoss = hatchet.win < hatchet.loss;
  const isOTL = bigAxe.win < bigAxe.loss;
  const isWin = !isLoss && !isOTL;

  return {
    matchWin: isWin ? 1 : 0,
    matchLoss: isLoss ? 1 : 0,
    matchOTL: isOTL ? 1 : 0,
    matchTotalScore: matchScore,

    hatchetRoundWin: hatchet.win,
    hatchetRoundLoss: hatchet.loss,
    hatchetRoundTie: hatchet.tie,

    hatchetClutchCall: hatchet.clutchCall,
    hatchetClutchHit: hatchet.clutchHit,

    hatchetFive: hatchet.five,
    hatchetThree: hatchet.three,
    hatchetOne: hatchet.one,
    hatchetDrop: hatchet.drop,

    bigAxeRoundWin: bigAxe.win,
    bigAxeRoundLoss: bigAxe.loss,

    bigAxeClutchCall: bigAxe.clutchCall,
    bigAxeClutchHit: bigAxe.clutchHit,

    bigAxeFive: bigAxe.five,
    bigAxeThree: bigAxe.three,
    bigAxeOne: bigAxe.one,
    bigAxeDrop: bigAxe.drop,
  };
};

const processMatch = async (page, matchId, profileIds) => {
  const url = `https://axescores.com/player/1/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;
  const timeout = toMilliseconds(0, 0, 5); // 5 seconds

  const [apiResponse] = await Promise.all([
    page.waitForResponse(isDesiredResponse('GET', 200, apiUrl), { timeout }),
    page.goto(url)
  ]);

  const rawMatch = await apiResponse.json();
  const players = rawMatch.players.filter(x => profileIds.has(x.id));

  await sequentially(players, async ({ id: profileId }) => {
    const stats = matchStats(rawMatch, profileId);

    await db.run(`
      UPDATE matches
      SET processed = 1, ${Object.keys(stats).map(x => `${x} = ?`).join(',\n')}
      WHERE profileId = ? AND id = ?
    `, [
      ...Object.values(stats),
      profileId,
      matchId
    ]);
  });
};

(async () => {
  try {
    console.log('Get Matches');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let profileIds = new Set(), matchIds = new Set();

    const unprocessedMatches = await db.query(`
      SELECT profileId, id
      FROM matches
      WHERE processed = 0;
    `);

    unprocessedMatches.forEach(({ profileId, id }) => {
      profileIds.add(profileId);
      matchIds.add(id);
    });

    await sequentially([...matchIds], async (matchId) => processMatch(page, matchId, profileIds));
    await browser.close();
    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();