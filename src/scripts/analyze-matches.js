const { db, logError } = require('../helpers');

(async () => {
  try {
    console.log('Analyze Matches');
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();