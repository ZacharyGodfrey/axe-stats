const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');

const IDLE_TIME = 5 * 1000; // 5 seconds
const TRAFFIC_DELAY = 5 * 1000; // 5 seconds
const BATCH_SIZE = 100; // matches to process per run

const delay = (ms) => {
  console.log(`Waiting for ${ms} milliseconds`);

  return new Promise((resolve) => setTimeout(resolve, ms));
};

const sequentially = async (items, action) => {
  return items.reduce((prev, item) => {
    return prev.then(() => action(item));
  }, Promise.resolve());
};

const byAscending = (fn) => {
  return (left, right) => {
    const l = fn(left), r = fn(right);

    return l < r ? -1 : l > r ? 1 : 0;
  }
};

const groupItems = (size, items) => {
  return items.reduce((groups, item) => {
    const group = groups[groups.length - 1];

    if (group.length < size) {
      group.push(item);
    } else {
      groups.push([item]);
    }

    return groups;
  }, [[]]);
};

const reactPageState = (page, selector) => {
  const getState = (element) => {
    return element._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState();
  };

  return page.$eval(selector, getState);
};

const getProfiles = async (page) => {
  const url = 'https://axescores.com/players/collins-rating';
  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  console.log(`HTTP GET: ${url}`);

  await page.goto(url);
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle({ idleTime: IDLE_TIME });

  const state = await reactPageState(page, '#root');
  const profiles = state.globalStandings.standings.career;

  return profiles.filter(x => x.active);
};

const storeProfileData = async (page, { id, name, rank, rating, average }) => {
  // Get profile page state

  const url = `https://axescores.com/player/${id}`;

  console.log(`Go to ${url}`);

  await page.goto(url);
  await page.waitForNetworkIdle({ idleTime: IDLE_TIME });

  const state = await reactPageState(page, '#root');
  const { about, leagues } = state.player.playerData;

  console.log(`Writing profile data for ID ${id} to the database`);

  await db.run(`INSERT OR IGNORE INTO profiles (id) VALUES (?);`, [id]);

  await db.run(`
    UPDATE profiles
    SET ${Object.entries({ name, about, rank, rating, average }).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(', ')}
    WHERE id = ?;
  `, [id]);

  // Ensure JSON file exists

  const filePath = path.resolve(__dirname, `../src/database/profiles/${id}.json`);
  const exists = await fs.pathExists(filePath);

  if (!exists) {
    const data = {
      matches: {}
    };

    console.log(`Creating profile JSON at ${filePath}`);

    await fs.outputFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // Insert match IDs into database

  const premierLeagues = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = premierLeagues.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  console.log(`Writing ${matches.length} match IDs to the database`);

  await db.run(`
    INSERT OR IGNORE INTO matches (id)
    VALUES ${matches.map(x => `(${x.id})`).join(', ')};
  `);
};

const roundOutcome = (playerScore, opponentScore) => {
  switch (true) {
    case playerScore > opponentScore: return 'win';
    case playerScore < opponentScore: return 'loss';
    default: return 'tie';
  }
};

const matchOutcome = (rounds) => {
  const { win, loss } = rounds.reduce((res, r) => Object.assign(res, { [r.outcome]: 1 + (res[r.outcome] || 0) }), {});

  switch (true) {
    case win - loss > 0: return 'win';
    case win - loss < 0: return rounds.length === 4 ? 'otl' : 'loss';
    default: return 'error';
  }
};

const buildMatch = ({ id, players, rounds }, playerId) => {
  const opponent = players.map(x => x.id).find(x => x !== playerId);
  const roundData = rounds
    .sort(byAscending(x => x.order))
    .map(x => {
      const p1 = x.games.find(y => y.player === playerId);
      const p2 = x.games.find(y => y.player === opponent);

      return {
        id: `${id}-${x.order}`,
        outcome: roundOutcome(p1.score, p2.score),
        isBigAxe: x.name === 'Tie Break',
        self: {
          score: p1.score,
          throws: p1.Axes.sort(byAscending(y => y.order)).map(y => ({
            score: y.score,
            isClutch: y.clutchCalled
          })),
        },
        opponent: {
          score: p2.score,
          throws: p2.Axes.sort(byAscending(y => y.order)).map(y => ({
            score: y.score,
            isClutch: y.clutchCalled
          }))
        }
      };
    });

  return {
    id,
    opponent,
    outcome: matchOutcome(roundData),
    rounds: roundData.filter(x => !x.isBigAxe),
    bigAxe: roundData.find(x => x.isBigAxe) || null
  };
};

const storeMatchData = async (page, matchId) => {
  const url = `https://axescores.com/player/1/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;

  console.log(`Go to ${url}`);

  await page.goto(url);

  const apiResponse = await page.waitForResponse(apiUrl, { timeout: IDLE_TIME });
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

  await db.run(`
    UPDATE matches
    SET processed = ?
    WHERE id = ?;
  `, [1, matchId]);
};

(async () => {
  try {
    // Setup

    console.log('Ensuring database tables exist');

    await db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY,
        name TEXT DEFAULT '',
        about TEXT DEFAULT '',
        rank INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 0,
        average REAL DEFAULT 0
      ) WITHOUT ROWID;
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY,
        processed INTEGER DEFAULT 0
      ) WITHOUT ROWID;
    `);

    console.log('Opening browser');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Profiles

    console.log('Getting profiles');

    // TODO: Remove filter after testing
    const profiles = (await getProfiles(page)).filter(x => x.id === 1207260);

    console.log(`Found ${profiles.length} active premier profiles`);

    console.log('Storing profile data');

    await sequentially(profiles, x => storeProfileData(page, x).then(() => delay(TRAFFIC_DELAY)));

    // Matches

    console.log('Getting match data');

    const { unprocessed } = await db.get(`
      SELECT COUNT(id) AS "unprocessed"
      FROM matches
      WHERE processed = 0;
    `);

    console.log(`There are ${unprocessed} unprocessed matches`);

    const newMatches = await db.query(`
      SELECT id
      FROM matches
      WHERE processed = 0
      LIMIT ?;
    `, [BATCH_SIZE]);

    console.log(`Processing ${newMatches.length} unprocessed matches`);

    await sequentially(newMatches, x => storeMatchData(page, x.id).then(() => delay(TRAFFIC_DELAY)));

    await fs.outputFile(path.resolve(__dirname, `../src/database/timestamp.json`), JSON.stringify(new Date().toISOString()), 'utf-8');

    // Shutdown

    console.log('Closing browser');

    await browser.close();
    await db.disconnect();

    console.log('Done');
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();