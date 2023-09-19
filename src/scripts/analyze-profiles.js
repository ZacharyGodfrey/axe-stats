const { db, logError } = require('../helpers');

(async () => {
  try {
    console.log('Analyze Profiles');
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();