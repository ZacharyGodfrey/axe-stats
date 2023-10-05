const puppeteer = require('puppeteer');

const config = require('../../_config.json');
const { db, sequentially, reactPageState, waitMilliseconds, logError } = require('../helpers');

const timeout = 2 * 1000; // 2 seconds

const getProfiles = async (page, profileIdSet) => {
  console.log('Scraping all profile data...');

  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const profiles = state.globalStandings.standings.career;

  return profiles.filter(x => profileIdSet.has(x.id));
};

const getProfileImage = async (id) => {
  const url = `https://admin.axescores.com/pic/${id}`;
  const response = await fetch(url);
  const buffer = await response.buffer();
  const base64 = buffer.toString('base64');

  return base64;
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
    (id) VALUES (?);
  `, [id]);

  await db.run(`
    UPDATE profiles
    SET name = ?, about = ?, rank = ?, rating = ?, image = ?
    WHERE id = ?;
  `, [name, about, rank, rating, image, id]);

  const premierLeagues = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = premierLeagues.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  await db.run(`
    INSERT OR IGNORE INTO matches
    (profileId, id) VALUES ${matches.map(x => `(${id}, ${x.id})`).join(', ')};
  `);
};

(async () => {
  try {
    console.log('# Get Profiles');
    console.log('Config: ', JSON.stringify(config, null, 2));

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const profileIdSet = new Set(config.profileIds);
    const profiles = await getProfiles(page, profileIdSet);

    await sequentially(profiles, async (profile) => processProfile(page, profile).catch(logError));
    await browser.close();
    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();