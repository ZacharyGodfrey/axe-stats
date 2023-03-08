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

  await db.query(`
    INSERT INTO profiles (id, name, standardRating, standardRank, standardAverage, premierRating, premierRank, premierAverage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `, [
    127008,
    'REDACTED',
    1500,
    184,
    65.2,
    1600,
    40,
    67.4
  ]);
};

const scrape = async () => {
  console.log('[SCRAPE] Begin Browser Operations');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const tasks = [];

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

  const profiles = await getProfiles(page, tasks);

  console.log(`[SCRAPE] Found ${profiles.length} Unique Profiles`);

  const jsonFile = db._fileName.replace('data.db', 'profiles.json');
  const jsonContent = JSON.stringify(profiles, null, 2);

  await fs.outputFile(jsonFile, jsonContent, 'utf-8');

  // profiles.forEach((profile) => {
  //   const sql = `
  //     INSERT INTO profiles (id, name, standardRank, standardRating, standardAverage, premierRank, premierRating, premierAverage)
  //     VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  //   `;

  //   const params = [
  //     profile.id,
  //     profile.name,
  //     profile.standard.rank || 0,
  //     profile.standard.rating || 0,
  //     profile.standard.average || 0,
  //     profile.premier.rank || 0,
  //     profile.premier.rating || 0,
  //     profile.premier.average || 0,
  //   ];

  //   tasks.push(db.query(sql, params));
  // });

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

  // const standardProfiles = (await reactPageState(page, '#root')).globalStandings.standings.career;

  // console.log(`[SCRAPE] Found ${standardProfiles.length} Standard Profiles`);

  // standardProfiles.forEach(({ id, name, rank, rating, average }) => {
  //   profilesById[id] = profilesById[id] || {
  //     id,
  //     name,
  //     standard: {},
  //     premier: {}
  //   };

  //   profilesById[id].standard.rank = rank;
  //   profilesById[id].standard.rating = rating;
  //   profilesById[id].standard.average = average;
  // });

  await page.select('.sc-gwVKww.fJdgsF select', 'IATF Premier');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

  const premierProfiles = (await reactPageState(page, '#root')).globalStandings.standings.career;

  console.log(`[SCRAPE] Found ${premierProfiles.length} Premier Profiles`);

  premierProfiles.forEach(({ id, name, rank, rating, average }) => {
    profilesById[id] = profilesById[id] || {
      id,
      name,
      standard: {},
      premier: {}
    };

    profilesById[id].premier.rank = rank;
    profilesById[id].premier.rating = rating;
    profilesById[id].premier.average = average;
  });

  return Object.values(profilesById);
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