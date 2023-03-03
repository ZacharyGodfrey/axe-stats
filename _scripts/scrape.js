const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const db = require('../src/database');

const deleteDatabase = async () => {
  console.log(`[SCRAPE] Delete Database: ${db._fileName}`);

  await fs.remove(db._fileName);
};

const ensureSchema = async () => {
  console.log('[SCRAPE] Ensure Schema');

  await db.query(`
    CREATE TABLE IF NOT EXISTS timestamp (
      id INTEGER PRIMARY KEY,
      timestamp TEXT NOT NULL UNIQUE
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      standardRank INTEGER NOT NULL,
      standardRating INTEGER NOT NULL,
      premierRank INTEGER NOT NULL,
      premierRating INTEGER NOT NULL
    ) WITHOUT ROWID;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY,
      urlId TEXT NOT NULL,
      name TEXT NOT NULL,
      ruleset TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles (id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) WITHOUT ROWID;
  `);
};

const seedTables = async () => {
  console.log('[SCRAPE] Seed Tables');

  const now = new Date().toISOString();

  const me = [
    '1207260',
    'REDACTED',
    1509,
    1621
  ];

  const seasons = [
    [
      '267739',
      'Axe Champs Tuesday Purple 2023 Spring premier',
      'Premier',
      '2023-01-11'
    ],
    [
      '251574',
      'Valhalla Fleming Island Saturday Yellow 2022 NYE Marathon League',
      'Premier',
      '2022-12-31'
    ]
  ];

  await db.query(`INSERT INTO timestamp (timestamp) VALUES(?);`, [now]);

  // const [profile] = await db.query(`
  //   INSERT INTO profiles (urlId, name, standardRating, premierRating)
  //   VALUES (?, ?, ?, ?) RETURNING *;
  // `, me);

  // await Promise.all(seasons.map(season => db.query(`
  //   INSERT INTO seasons (profileId, urlId, name, ruleset, date)
  //   VALUES (?, ?, ?, ?, ?);
  // `, [profile.id, ...season])));
};

const scrape = async () => {
  console.log('[SCRAPE] Begin Browser Operations');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const timeout = 10 * 1000;

  await page.goto('https://axescores.com/players/collins-rating');

  await page.waitForResponse(responseHandler({
    status: 200,
    method: 'GET',
    url: 'https://api.axescores.com/players',
    handler: playersHandler
  }), { timeout });

  await browser.close();
};

const responseHandler = ({ status, method, url, handler }) => async (response) => {
  if (response.status() !== status) return false;
  if (response.request().method() !== method) return false;
  if (response.url() !== url) return false;

  const data = response.json();

  return handler(data).then(() => true).catch(() => false);
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
      INSER INTO profiles (id, name, standardRank, standardRating, premierRank, premierRating)
      VALUES (?, ?, ?, ?, ?, ?);
    `, params);
  }));
};

(async () => {
  try {
    await deleteDatabase();
    await ensureSchema();
    await seedTables();
    await scrape();

    console.log('[SCRAPE] All steps completed successfully.');
  } catch (error) {
    console.log(error);

    process.exit(1);
  }
})();