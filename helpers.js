const sqlite = require('better-sqlite3');

const config = require('./config')

const database = new sqlite(config.databaseFile, {});

exports.db = (() => {
  const enums = {
    matchState: {
      unprocessed: 0,
      invalid: 1,
      forfeit: 2,
      valid: 3
    }
  };

  if (config.resetAllData) {
    database.prepare(`DROP TABLE IF EXISTS profiles`).run();
    database.prepare(`DROP TABLE IF EXISTS matches`).run();
    database.prepare(`DROP TABLE IF EXISTS seasons`).run();
  }

  database.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
      profileId INTEGER PRIMARY KEY,

      name TEXT NOT NULL DEFAULT '',
      about TEXT DEFAULT '',
      rank INTEGER NOT NULL DEFAULT 0,
      rating INTEGER NOT NULL DEFAULT 0,
      image TEXT NOT NULL DEFAULT '',
      stats TEXT NOT NULL DEFAULT '{}',
      badges TEXT NOT NULL DEFAULT '[]'
    ) WITHOUT ROWID;
  `).run();

  database.prepare(`
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
      stats TEXT NOT NULL DEFAULT '{}',

      PRIMARY KEY (matchId, profileId)
    ) WITHOUT ROWID;
  `).run();

  database.prepare(`
    CREATE TABLE IF NOT EXISTS seasons (
      profileId INTEGER NOT NULL,
      seasonId INTEGER NOT NULL,

      name TEXT NOT NULL DEFAULT '',
      shortName TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT '',
      seasonRank INTEGER NOT NULL DEFAULT 0,
      playoffRank INTEGER NOT NULL DEFAULT 0,
      stats TEXT NOT NULL DEFAULT '{}',

      PRIMARY KEY (seasonId, profileId)
    ) WITHOUT ROWID;
  `).run();

  return {
    enums,
    run: (sql, params = []) => database.prepare(sql).run(params),
    row: (sql, params = []) => database.prepare(sql).get(params),
    rows: (sql, params = []) => database.prepare(sql).all(params)
  };
})();

exports.sequentially = async (items, action) => {
  return items.reduce((prev, item, index) => {
    return prev.then(() => action(item, index));
  }, Promise.resolve());
};

exports.sum = (values) => values.reduce((t, v) => t + v, 0);

const round = exports.round = (value, places) => {
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

exports.badges = (() => {
  const roundBadges = [
    {
      title: 'Unnatural Round',
      description: 'Score 25 points in a round with a clutch hit',
      earned: (matches) => false
    },
    {
      title: 'Natural Round',
      description: 'Score 25 points in a round without a clutch hit',
      earned: (matches) => false
    },
    {
      title: 'Supernatural Round',
      description: 'Score more than 25 points in a round',
      earned: (matches) => false
    },
    {
      title: 'Overtime Win',
      description: 'Win a round of Big Axe',
      earned: (matches) => false
    },
    {
      title: 'Long Shot',
      description: 'Hit a clutch with a Big Axe',
      earned: (matches) => false
    }
  ].map(x => ({ ...x, type: 'Round' }));

  const matchBadges = [
    {
      title: 'Unnatural Match',
      description: 'Score 75 points in a match with a clutch hit',
      earned: (matches) => false
    },
    {
      title: 'Natural Match',
      description: 'Score 75 points in a match without a clutch hit',
      earned: (matches) => false
    },
    {
      title: 'Supernatural Match',
      description: 'Score more than 75 points in a match',
      earned: (matches) => false
    },
    {
      title: '777',
      description: 'Hit all three clutches in a match',
      earned: (matches) => false
    },
    {
      title: 'Perfection',
      description: 'Score 81 points in a match',
      earned: (matches) => false
    }
  ].map(x => ({ ...x, type: 'Match' }));

  const seasonBadges = [
    {
      title: '',
      description: 'Complete a season with an average score of 70 or higher',
      earned: (matches) => false
    },
    {
      title: 'Shot Caller',
      description: 'Complete a season with a clutch call rate of 100%',
      earned: (matches) => false
    },
    {
      title: 'Top Performer',
      description: 'Complete a season with the #1 regular season rank',
      earned: (matches) => false
    },
    {
      title: 'Champion',
      description: 'Complete a season with the #1 playoff rank',
      earned: (matches) => false
    }
  ].map(x => ({ ...x, type: 'Season' }));

  const careerBadges = [
    //
  ].map(x => ({ ...x, type: 'Career' }));

  const secretBadges = [
    {
      title: 'No Cigar',
      description: 'Score 79 points in a match',
      earned: (matches) => false
    },
    {
      title: 'Mismatch Win',
      description: 'Win a match with a lower total score than your opponent',
      earned: (matches) => false
    },
    {
      title: 'Mismatch Loss',
      description: 'Lose a match with a higher total score than your opponent',
      earned: (matches) => false
    }
  ].map(x => ({ ...x, type: 'Secret' }));

  return {
    round: roundBadges,
    match: matchBadges,
    season: seasonBadges,
    career: careerBadges,
    secret: secretBadges,
    all: [
      ...roundBadges,
      ...matchBadges,
      ...seasonBadges,
      ...careerBadges,
      ...secretBadges,
    ]
  }
})();