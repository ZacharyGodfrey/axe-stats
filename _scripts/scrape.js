const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');

const deleteDatabase = async () => {
  console.log(`[SCRAPE] Delete Database: ${db._fileName}`);

  await fs.remove(db._fileName);
};

const seedTables = async () => {
  console.log('[SCRAPE] Seed Tables');

  await db.query(`
    INSERT INTO timestamp (timestamp)
    VALUES (?);
  `, [new Date().toISOString()]);
};

const scrape = async () => {
  console.log('[SCRAPE] Begin Browser Operations');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const tasks = [];

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

  const profiles = await getProfiles(page, tasks);

  profiles.forEach((profile) => {
    const sql = `
      INSERT INTO profiles (id, name, standardRank, standardRating, standardAverage, premierRank, premierRating, premierAverage, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const params = [
      profile.id,
      profile.name,
      profile.standardRank || 0,
      profile.standardRating || 0,
      profile.standardAverage || 0,
      profile.premierRank || 0,
      profile.premierRating || 0,
      profile.premierAverage || 0,
      profile.isActive || 0
    ];

    tasks.push(db.query(sql, params));
  });

  await Promise.all(tasks);

  await browser.close();
};

const reactPageState = (page, selector) => {
  return page.$eval(selector, (element) => {
    const { getState } = element._reactRootContainer._internalRoot.current.memoizedState.element.props.store;

    return getState();
  });
};

const getProfiles = async (page) => {
  console.log('[SCRAPE] Store Profiles');

  const profilesById = {};

  const standardProfiles = (await reactPageState(page, '#root'))
    .globalStandings.standings.career
    .filter(({ active }) => active);

  console.log(`[SCRAPE] Found ${standardProfiles.length} Standard Profiles`);

  standardProfiles.forEach(({ id, name, rank, rating, average }) => {
    profilesById[id] = profilesById[id] || {
      id,
      name,
      standardRank: 0,
      standardRating: 0,
      standardAverage: 0,
      premierRank: 0,
      premierRating: 0,
      premierAverage: 0,
      isActive: 0
    };

    profilesById[id].standardRank = rank;
    profilesById[id].standardRating = rating;
    profilesById[id].standardAverage = average;
    profilesById[id].isActive = profilesById[id].isActive || rank ? 1 : 0;
  });

  await page.select('.sc-gwVKww.fJdgsF select', 'IATF Premier');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

  const premierProfiles = (await reactPageState(page, '#root'))
    .globalStandings.standings.career
    .filter(({ active }) => active);

  console.log(`[SCRAPE] Found ${premierProfiles.length} Premier Profiles`);

  premierProfiles.forEach(({ id, name, rank, rating, average }) => {
    profilesById[id] = profilesById[id] || {
      id,
      name,
      standardRank: 0,
      standardRating: 0,
      standardAverage: 0,
      premierRank: 0,
      premierRating: 0,
      premierAverage: 0,
      isActive: 0
    };

    profilesById[id].premierRank = rank;
    profilesById[id].premierRating = rating;
    profilesById[id].premierAverage = average;
    profilesById[id].isActive = profilesById[id].isActive || rank ? 1 : 0;
  });

  const allProfiles = Object.values(profilesById);

  console.log(`[SCRAPE] Found ${allProfiles.length} Unique Profiles`);

  const activeProfiles = allProfiles.filter(({ isActive }) => isActive);

  console.log(`[SCRAPE] Found ${activeProfiles.length} Active Profiles`);

  console.log(`[SCRAPE] Found ${allProfiles.length - activeProfiles.length} Inactive Profiles`);

  return allProfiles;
};

(async () => {
  try {
    await deleteDatabase();
    await db.ensureSchema();
    await seedTables();
    await scrape();

    console.log('[SCRAPE] All steps completed successfully.');
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();