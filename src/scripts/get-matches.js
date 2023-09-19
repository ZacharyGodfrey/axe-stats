const { db, logError } = require('../helpers');

(async () => {
  try {
    console.log('Get Matches');
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();