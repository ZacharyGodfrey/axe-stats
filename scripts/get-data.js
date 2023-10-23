const puppeteer = require('puppeteer');

const config = require('../config.json');
const { db, sequentially, isDesiredResponse, reactPageState, waitMilliseconds, logError } = require('./helpers');

const timeout = 2 * 1000;

const getProfiles = async (page, profileIds) => {
  const profileIdSet = new Set(profileIds);
  const rulesetSelector = '.sc-gwVKww.fJdgsF select';

  await page.goto('https://axescores.com/players/collins-rating');
  await page.waitForSelector(rulesetSelector);
  await page.select(rulesetSelector, 'IATF Premier');
  await page.waitForNetworkIdle();

  const state = await reactPageState(page, '#root');
  const allProfiles = state.globalStandings.standings.career;
  const profiles = allProfiles.filter(x => profileIdSet.has(x.id));

  await sequentially(profiles, async (profile) => processProfile(page, profile).catch(logError));
};

const processProfile = async (page, { id: profileId, rank, rating }) => {
  console.log(`Scraping profile data for profile ID ${profileId}`);

  await page.goto(`https://axescores.com/player/${profileId}`);
  await waitMilliseconds(timeout);

  const image = await getProfileImage(profileId);
  const state = await reactPageState(page, '#root');
  const { name, about, leagues } = state.player.playerData;
  const seasons = leagues.filter(x => x.performanceName === 'IATF Premier');
  const weeks = seasons.flatMap(x => x.seasonWeeks);
  const matches = weeks.flatMap(x => x.matches);

  db.run(`
    INSERT OR IGNORE INTO profiles
    (profileId) VALUES (?)
  `, [profileId]);

  db.run(`
    UPDATE profiles
    SET name = ?, about = ?, rank = ?, rating = ?, image = ?
    WHERE profileId = ?
  `, [name, about, rank, rating, image, profileId]);

  db.run(`
    INSERT OR IGNORE INTO seasons
    (seasonId, profileId) VALUES ${seasons.map(x => `(${x.id}, ${profileId})`).join(', ')}
  `);

  seasons.forEach(({ id: seasonId, date, name, shortName, seasonRank, playoffRank }) => {
    db.run(`
      UPDATE seasons
      SET name = ?, shortName = ?, date = ?, seasonRank = ?, playoffRank = ?
      WHERE seasonId = ? AND profileId = ?
    `, [
      name,
      shortName,
      date,
      seasonRank || 0,
      playoffRank || 0,
      seasonId,
      profileId
    ]);
  });

  db.run(`
    INSERT OR IGNORE INTO matches
    (matchId, profileId) VALUES ${matches.map(x => `(${x.id}, ${profileId})`).join(', ')}
  `);
};

const getProfileImage = async (profileId) => {
  console.log(`Scraping profile image for profile ID ${profileId}`);

  const url = `https://admin.axescores.com/pic/${profileId}`;
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return base64;
};

const getMatches = async (page) => {
  let profileIds = new Set(), matchIds = new Set();

  const unprocessedMatches = db.rows(`
    SELECT profileId, matchId
    FROM matches
    WHERE state = ?
  `, [db.enums.matchState.unprocessed]);

  unprocessedMatches.forEach(({ profileId, matchId }) => {
    profileIds.add(profileId);
    matchIds.add(matchId);
  });

  await sequentially([...matchIds], async (matchId) => processMatch(page, matchId, profileIds).catch(logError));
};

const processMatch = async (page, matchId, profileIds) => {
  const url = `https://axescores.com/player/1/${matchId}`;
  const apiUrl = `https://api.axescores.com/match/${matchId}`;

  const [apiResponse] = await Promise.all([
    page.waitForResponse(isDesiredResponse('GET', 200, apiUrl), { timeout }),
    page.goto(url)
  ]);

  const rawMatch = await apiResponse.json();
  const players = rawMatch.players.filter(x => profileIds.has(x.id));

  players.forEach(({ id: profileId }) => {
    console.log(`Processing match details for match ID ${matchId} profile ID ${profileId}`);

    const { state, outcome, total, rounds } = mapMatch(profileId, rawMatch);

    db.run(`
      UPDATE matches
      SET state = ?, outcome = ?, total = ?, rounds = ?
      WHERE matchId = ? AND profileId = ?
    `, [
      state,
      outcome,
      total,
      JSON.stringify(rounds),
      matchId,
      profileId
    ]);
  });
};

const mapMatch = (profileId, rawMatch) => {
  const match = {
    matchId: rawMatch.id,
    profileId,
    state: db.enums.matchState.unprocessed,
    outcome: '',
    total: 0,
    rounds: []
  };

  const invalidRoundCount = rawMatch.rounds.length > 4;
  const forfeit = rawMatch.players.find(x => x.id === profileId)?.forfeit === true;
  const states = db.enums.matchState;

  match.state = invalidRoundCount ? states.invalid : forfeit ? states.forfeit : states.valid;

  if (invalidRoundCount) {
    return match;
  }

  let roundWins = 0, roundLosses = 0, bigAxeWins = 0, bigAxeLosses = 0;

  rawMatch.rounds.forEach((rawRound) => {
    const opponent = rawRound.games.find(x => x.player !== profileId);
    const { score: total, Axes: throws } = rawRound.games.find(x => x.player === profileId);
    const round = {
      outcome: '',
      total,
      throws: throws.map(({ score, clutchCalled: clutch }) => ({ score, clutch })),
      bigAxe: rawRound.name === 'Tie Break'
    };

    switch (true) {
      case total  >  opponent.score: round.outcome = 'W'; break;
      case total  <  opponent.score: round.outcome = 'L'; break;
      case total === opponent.score: round.outcome = 'T'; break;
    }

    match.total += round.bigAxe ? 0 : total;

    if (round.bigAxe) {
      switch (round.outcome) {
        case 'W': bigAxeWins++; break;
        case 'L': bigAxeLosses++; break;
      }
    } else {
      switch (round.outcome) {
        case 'W': roundWins++; break;
        case 'L': roundLosses++; break;
      }
    }

    match.rounds.push(round);
  });

  switch (true) {
    case roundWins > roundLosses:   match.outcome = 'W'; break;
    case bigAxeWins > bigAxeLosses: match.outcome = 'W'; break;
    case roundLosses > roundWins:   match.outcome = 'L'; break;
    case bigAxeLosses > bigAxeWins: match.outcome = 'O'; break;
  }

  return match;
};

(async () => {
  try {
    console.log('Config: ', JSON.stringify(config, null, 2));

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log([
      '**********',
      'Getting profiles',
      '**********'
    ].join('\n'));

    await getProfiles(page, config.profileIds);

    console.log([
      '**********',
      'Getting matches',
      '**********'
    ].join('\n'));

    await getMatches(page);

    await browser.close();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();