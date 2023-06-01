const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');
const { ensureTables, sequentially, logErrorAndDefault } = require('./scrape-helpers');

const BATCH_SIZE = 100; // matches to process per run

let httpRequestCount = 0;
let processedMatchCount = 0;

const toMilliseconds = (hours, minutes, seconds) => {
  const m = (60 * hours) + minutes;
  const s = (60 * m) + seconds;

  return 1000 * s;
};

const storeMatchData = async (page, matchId) => {
  const url = `https://axescores.com/player/${randomInt(1, 26)}/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;
  const timeout = toMilliseconds(0, 0, 5); // 5 seconds

  console.log(`Go to ${url}`);

  const [apiResponse] = await Promise.all([
    page.waitForResponse(isDesiredResponse('GET', 200, apiUrl), { timeout }),
    page.goto(url)
  ]);

  httpRequestCount++;

  const rawMatch = await apiResponse.json();

  await sequentially(rawMatch.players, async ({ id: playerId }) => {
    const filePath = path.resolve(__dirname, `../src/database/profiles/${playerId}.json`);
    const exists = await fs.pathExists(filePath);

    if (!exists) {
      return;
    }

    const profile = await fs.readJson(filePath);

    profile.matches[matchId] = buildMatch(rawMatch, playerId);

    console.log(`Writing match data to ${filePath}`);

    await fs.outputFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
  });

  console.log(`Updating match ID ${matchId} in the database`);

  await db.run(`UPDATE matches SET processed = 1 WHERE id = ${matchId};`);
};

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const isDesiredResponse = (method, status, url) => {
  return (response) => {
    return response.request().method() === method
      && response.status() === status
      && response.url() === url;
  };
};

const buildMatch = ({ id, players, rounds }, playerId) => {
  const { id: opponentId } = players.find(x => x.id !== playerId);
  const roundData = rounds
    .sort(byAscending(round => round.order))
    .map(round => {
      const self = round.games.find(game => game.player === playerId);
      const opponent = round.games.find(game => game.player === opponentId);

      return {
        id: `${id}-${round.order}`,
        outcome: roundOutcome(self.score, opponent.score),
        isBigAxe: round.name === 'Tie Break',
        self: {
          score: self.score,
          throws: self.Axes.sort(byAscending(axe => axe.order)).map(axe => ({
            score: axe.score,
            isClutch: axe.clutchCalled
          })),
        },
        opponent: {
          score: opponent.score,
          throws: opponent.Axes.sort(byAscending(axe => axe.order)).map(axe => ({
            score: axe.score,
            isClutch: axe.clutchCalled
          }))
        }
      };
    });

  return {
    id,
    opponentId,
    outcome: matchOutcome(roundData),
    rounds: roundData.filter(round => !round.isBigAxe),
    bigAxe: roundData.find(round => round.isBigAxe) || null
  };
};

const byAscending = (fn) => {
  return (left, right) => {
    const l = fn(left), r = fn(right);

    return l < r ? -1 : l > r ? 1 : 0;
  }
};

const roundOutcome = (playerScore, opponentScore) => {
  switch (true) {
    case playerScore > opponentScore: return 'win';
    case playerScore < opponentScore: return 'loss';
    default: return 'tie';
  }
};

const matchOutcome = (rounds) => {
  const { win, loss } = rounds.reduce((result, round) => {
    return Object.assign(result, {
      [round.outcome]: 1 + (result[round.outcome] || 0)
    });
  }, { win: 0, loss: 0 });

  switch (true) {
    case win - loss > 0: return 'win';
    case win - loss < 0: return rounds.length === 4 ? 'otl' : 'loss';
    default: return 'error';
  }
};

(async () => {
  const startTime = Date.now();
  const maxRunTime = startTime + toMilliseconds(0, 5, 0); // 5 minutes

  let exitCode = 0;

  try {
    console.log('Ensuring database tables exist');

    await ensureTables();

    console.log('Opening browser');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log('Getting match data');

    const { totalMatches } = await db.get(`SELECT COUNT(id) AS "totalMatches" FROM matches;`);
    const { unprocessed } = await db.get(`SELECT COUNT(id) AS "unprocessed" FROM matches WHERE processed = 0;`);

    console.log(`There are ${totalMatches} total matches`);
    console.log(`There are ${unprocessed} unprocessed matches`);

    let newMatchIds = [];

    do {
      newMatchIds = await db.query(`SELECT id FROM matches WHERE processed = 0 LIMIT ${BATCH_SIZE};`);

      await sequentially(newMatchIds, ({ id: matchId }, index) => {
        console.log(`[${index + 1} / ${newMatchIds.length}] Processing match ID ${matchId}`);

        await storeMatchData(page, matchId).catch(logErrorAndDefault(null));

        processedMatchCount++;
      });
    } while (Date.now() < maxRunTime && newMatchIds.length > 0);

    const timestampFile = path.resolve(__dirname, `../src/database/timestamp.json`);
    const timestampValue = JSON.stringify(new Date().toISOString());

    await fs.outputFile(timestampFile, timestampValue, 'utf-8');

    console.log('Closing browser');

    await browser.close();
    await db.disconnect();

    console.log('Done');
  } catch (error) {
    console.log(error);

    exitCode = 1;
  } finally {
    const endTime = Date.now();
    const duration = Math.ceil((endTime - startTime) / 1000);
    const requestRate = Math.round(httpRequestCount / duration);

    console.log(`Processed ${processedMatchCount} matches in ${duration} seconds`);
    console.log(`Made ${httpRequestCount} HTTP requests in ${duration} seconds (${requestRate} per second)`);

    process.exit(exitCode);
  }
})();