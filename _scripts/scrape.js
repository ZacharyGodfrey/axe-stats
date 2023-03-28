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
  const profiles = await getProfiles(page);
  const groupedProfiles = groupItems(10, profiles);

  await Promise.all(groupItems(10, profiles).map(async (group) => {
    const valueGroups = group.map((profile) => {
      const values = [
        profile.id,
        `'${profile.name}'`,
        profile.standardRank,
        profile.standardRating,
        profile.standardAverage,
        profile.premierRank,
        profile.premierRating,
        profile.premierAverage,
      ];

      return `(${values.join(', ')})`;
    });

    await db.query(`
      INSERT INTO profiles (
        id,
        name,
        standardRank,
        standardRating,
        standardAverage,
        premierRank,
        premierRating,
        premierAverage
      ) VALUES ${valueGroups.join(', ')};
    `);
  }));

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

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForNetworkIdle({ idleTime: 2 * 1000 });

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
      premierAverage: 0
    };

    profilesById[id].standardRank = rank;
    profilesById[id].standardRating = rating;
    profilesById[id].standardAverage = average;
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
      premierAverage: 0
    };

    profilesById[id].premierRank = rank;
    profilesById[id].premierRating = rating;
    profilesById[id].premierAverage = average;
  });

  const allProfiles = Object.values(profilesById);

  console.log(`[SCRAPE] Found ${allProfiles.length} Unique Profiles`);

  return allProfiles;
};

const groupItems = (size, items) => {
  return items.reduce((groups) => {
    const group = groups[groups.length - 1];

    if (group.length < size) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }, [[]]);
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