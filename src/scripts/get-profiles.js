const { db, logError } = require('../helpers');

(async () => {
  try {
    console.log('Get Profiles');
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();