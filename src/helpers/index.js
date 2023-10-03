const ensureTables = async (db) => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY,
      name TEXT DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 0,

      matchWin INTEGER DEFAULT 0,
      matchLoss INTEGER DEFAULT 0,
      matchOTL INTEGER DEFAULT 0,
      matchTotalScore INTEGER DEFAULT 0,

      hatchetRoundWin INTEGER DEFAULT 0,
      hatchetRoundLoss INTEGER DEFAULT 0,
      hatchetRoundTie INTEGER DEFAULT 0,
      hatchetTotalScore INTEGER DEFAULT 0,
      hatchetThrowCount INTEGER DEFAULT 0,

      hatchetClutchCall INTEGER DEFAULT 0,
      hatchetClutchHit INTEGER DEFAULT 0,

      hatchetFive INTEGER DEFAULT 0,
      hatchetThree INTEGER DEFAULT 0,
      hatchetOne INTEGER DEFAULT 0,
      hatchetDrop INTEGER DEFAULT 0,

      bigAxeRoundWin INTEGER DEFAULT 0,
      bigAxeRoundLoss INTEGER DEFAULT 0,
      bigAxeTotalScore INTEGER DEFAULT 0,
      bigAxeThrowCount INTEGER DEFAULT 0,

      bigAxeClutchCall INTEGER DEFAULT 0,
      bigAxeClutchHit INTEGER DEFAULT 0,

      bigAxeFive INTEGER DEFAULT 0,
      bigAxeThree INTEGER DEFAULT 0,
      bigAxeOne INTEGER DEFAULT 0,
      bigAxeDrop INTEGER DEFAULT 0

    ) WITHOUT ROWID;
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS matches (
      profileId INTEGER NOT NULL,
      id INTEGER NOT NULL,
      processed INTEGER DEFAULT 0,

      matchWin INTEGER DEFAULT 0,
      matchLoss INTEGER DEFAULT 0,
      matchOTL INTEGER DEFAULT 0,
      matchTotalScore INTEGER DEFAULT 0,

      hatchetRoundWin INTEGER DEFAULT 0,
      hatchetRoundLoss INTEGER DEFAULT 0,
      hatchetRoundTie INTEGER DEFAULT 0,

      hatchetClutchCall INTEGER DEFAULT 0,
      hatchetClutchHit INTEGER DEFAULT 0,

      hatchetFive INTEGER DEFAULT 0,
      hatchetThree INTEGER DEFAULT 0,
      hatchetOne INTEGER DEFAULT 0,
      hatchetDrop INTEGER DEFAULT 0,

      bigAxeRoundWin INTEGER DEFAULT 0,
      bigAxeRoundLoss INTEGER DEFAULT 0,

      bigAxeClutchCall INTEGER DEFAULT 0,
      bigAxeClutchHit INTEGER DEFAULT 0,

      bigAxeFive INTEGER DEFAULT 0,
      bigAxeThree INTEGER DEFAULT 0,
      bigAxeOne INTEGER DEFAULT 0,
      bigAxeDrop INTEGER DEFAULT 0,

      PRIMARY KEY (profileId, id)
    ) WITHOUT ROWID;
  `);
};

const sequentially = async (items, action) => {
  return items.reduce((prev, item, index) => {
    return prev.then(() => action(item, index));
  }, Promise.resolve());
};

const sum = (values) => values.reduce((t, v) => t + v, 0);

const round = (value, places) => {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
};

const average = (values) => sum(values) / Math.max(1, values.length);

const reactPageState = (page, selector) => {
  const getState = (element) => {
    return element._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState();
  };

  return page.$eval(selector, getState);
};

const logError = (error) => {
  console.log('**********');

  console.log(JSON.stringify({
    message: error.message,
    stack: error.stack.split('\n').slice(1)
  }, null, 2));

  console.log('**********');
};

const logErrorAndDefault = (defaultValue) => {
  return (error) => {
    logError(error);

    return defaultValue;
  };
};

module.exports = {
  db: require('./database'),
  ensureTables,
  sequentially,
  sum,
  round,
  average,
  reactPageState,
  logError,
  logErrorAndDefault
};