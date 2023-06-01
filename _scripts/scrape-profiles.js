const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');
const { ensureTables, sequentially, logErrorAndDefault } = require('./scrape-helpers');

let httpRequestCount = 0;

const getProfiles = async (page) => {
  const url = 'https://axescores.com/players/collins-rating';
  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  console.log(`Go to ${url}`);

  await page.goto(url);
  httpRequestCount++;

  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const profiles = state.globalStandings.standings.career;

  return profiles.filter(x => x.active);
};

const reactPageState = (page, selector) => {
  const getState = (element) => {
    return element._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState();
  };

  return page.$eval(selector, getState);
};

const storeProfileData = async (page, { id, name, rank, rating, average }) => {
  const url = `https://axescores.com/player/${id}`;

  console.log(`Go to ${url}`);

  await page.goto(url);
  httpRequestCount++;

  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const { about, leagues } = state.player.playerData;

  console.log(`Writing profile data for ID ${id} to the database`);

  await db.run(`INSERT OR IGNORE INTO profiles (id) VALUES (${id});`);

  let placeholderPairs = [];
  let values = [];

  Object.entries({ name, about, rank, rating, average }).forEach(([k, v]) => {
    placeholderPairs.push(`${k} = ?`);
    values.push(v);
  });

  await db.run(`UPDATE profiles SET ${placeholderPairs.join(',\n')} WHERE id = ${id};`, values);

  const filePath = path.resolve(__dirname, `../src/database/profiles/${id}.json`);
  const exists = await fs.pathExists(filePath);

  if (!exists) {
    const data = {
      matches: {}
    };

    console.log(`Creating profile JSON at ${filePath}`);

    await fs.outputFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  const premierLeagues = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = premierLeagues.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  console.log(`Writing ${matches.length} match IDs to the database`);

  await db.run(`INSERT OR IGNORE INTO matches (id) VALUES ${matches.map(x => `(${x.id})`).join(', ')};`);
};

(async () => {
  const startTime = Date.now();

  let exitCode = 0;

  try {
    console.log('Ensuring database tables exist');

    await ensureTables();

    console.log('Opening browser');

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log('Getting profiles');

    const startTime = Date.now();
    const profiles = await getProfiles(page).catch(logErrorAndDefault([]));

    console.log(`Found ${profiles.length} active premier profiles`);

    console.log('Storing profile data');

    await sequentially(profiles, (profile, index) => {
      console.log(`[${index + 1} / ${profiles.length}] Processing profile ID ${profile.id}`);

      return storeProfileData(page, profile).catch(logErrorAndDefault(null));
    });

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

    console.log(`Made ${httpRequestCount} HTTP requests in ${duration} seconds (${requestRate} per second)`);

    process.exit(exitCode);
  }
})();