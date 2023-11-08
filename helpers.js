const sqlite = require('better-sqlite3');

const config = require('./config')

const db = new sqlite(config.databaseFile, {});

exports.db = (() => {
  const enums = {
    matchState: {
      unprocessed: 0,
      invalid: 1,
      forfeit: 2,
      valid: 3
    }
  };

  db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
      profileId INTEGER PRIMARY KEY,

      name TEXT NOT NULL DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT ''
    ) WITHOUT ROWID;
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS matches (
      profileId INTEGER NOT NULL,
      matchId INTEGER NOT NULL,

      opponentId INTEGER NOT NULL DEFAULT 0,
      week INTEGER NOT NULL DEFAULT 0,
      seasonId INTEGER NOT NULL DEFAULT 0,

      state INTEGER CHECK(state IN (${Object.values(enums.matchState).join(', ')})) NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT '',
      total INTEGER NOT NULL DEFAULT 0,
      rounds TEXT NOT NULL DEFAULT '[]',

      PRIMARY KEY (matchId, profileId)
    ) WITHOUT ROWID;
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS seasons (
      profileId INTEGER NOT NULL,
      seasonId INTEGER NOT NULL,

      name TEXT NOT NULL DEFAULT '',
      shortName TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      seasonRank INTEGER NOT NULL DEFAULT 0,
      playoffRank INTEGER NOT NULL DEFAULT 0,

      PRIMARY KEY (seasonId, profileId)
    ) WITHOUT ROWID;
  `).run();

  return {
    enums,
    run: (sql, params = []) => db.prepare(sql).run(params),
    row: (sql, params = []) => db.prepare(sql).get(params),
    rows: (sql, params = []) => db.prepare(sql).all(params)
  };
})();

exports.sequentially = async (items, action) => {
  return items.reduce((prev, item, index) => {
    return prev.then(() => action(item, index));
  }, Promise.resolve());
};

exports.sum = (values) => values.reduce((t, v) => t + v, 0);

exports.round = (value, places) => {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
};

exports.median = (values) => {
  if (!values) {
    return undefined;
  }

  const sorted = [...values].sort();
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const left = sorted[middle];
    const right = sorted[middle + 1];

    return (left + right) / 2;
  } else {
    return sorted[middle];
  }
};

exports.roundForDisplay = (value) => isNaN(value) ? 0 : round(value, 2);

exports.average = (values) => sum(values) / Math.max(1, values.length);

exports.isDesiredResponse = (method, status, url) => {
  return (response) => {
    return response.request().method() === method
      && response.status() === status
      && response.url() === url;
  };
};

exports.reactPageState = (page, selector) => {
  const getState = (element) => {
    return element._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState();
  };

  return page.$eval(selector, getState);
};

exports.waitMilliseconds = (milliseconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

exports.logError = (error) => {
  console.log('**********');

  console.log(JSON.stringify({
    message: error.message,
    stack: error.stack.split('\n').slice(1)
  }, null, 2));

  console.log('**********');
};

exports.logErrorAndDefault = (defaultValue) => {
  return (error) => {
    logError(error);

    return defaultValue;
  };
};