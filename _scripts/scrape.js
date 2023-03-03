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
  const timeout = 10 * 1000;
  let tasks = [];

  await page.goto('https://axescores.com/players/collins-rating');

  await page.waitForResponse(responseHandler(tasks, {
    status: 200,
    method: 'GET',
    url: 'https://api.axescores.com/players',
    handler: playersHandler
  }), { timeout });

  await Promise.all(tasks);

  await browser.close();
};

const responseHandler = (tasks, { status, method, url, handler }) => async (response) => {
  if (response.status() !== status) return false;
  if (response.request().method() !== method) return false;
  if (response.url() !== url) return false;

  tasks.push(response.json().then(handler));

  return true;
};

const playersHandler = async ({ ratingsCategories }) => {
  console.log('[SCRAPE] Handle Players Data');

  const { players: standard } = ratingsCategories['IATF Standard'];
  const { players: premier } = ratingsCategories['IATF Premier'];
  const profilesById = {};

  console.log(`[SCRAPE] Found ${standard.length} Standard Players`);
  console.log(`[SCRAPE] Found ${premier.length} Premier Players`);

  standard.forEach(({ id, name, rank, rating }) => {
    profilesById[id] = profilesById[id] || {
      id,
      name,
      standard: {},
      premier: {}
    };

    const stats = profilesById[id].standard;

    stats.rank = rank;
    stats.rating = rating;
  });

  premier.forEach(({ id, name, rank, rating }) => {
    profilesById[id] = profilesById[id] || {
      id,
      name,
      standard: {},
      premier: {}
    };

    const stats = profilesById[id].premier;

    stats.rank = rank;
    stats.rating = rating;
  });

  const uniqueProfiles = Object.values(profilesById);

  console.log(`[SCRAPE] Found ${uniqueProfiles.length} Unique Profiles`);

  await Promise.all(uniqueProfiles.map(async (profile) => {
    const params = [
      profile.id,
      profile.name,
      profile.standard.rank || 0,
      profile.standard.rating || 0,
      profile.premier.rank || 0,
      profile.premier.rank || 0,
    ];

    await db.query(`
      INSERT INTO profiles (id, name, standardRank, standardRating, premierRank, premierRating)
      VALUES (?, ?, ?, ?, ?, ?);
    `, params);
  }));
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