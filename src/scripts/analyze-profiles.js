const db = require('../helpers/database');

(async () => {
  try {
    console.log('Analyze Profiles');
  } catch (error) {
    console.log('**********');
    console.log(JSON.stringify({
      message: error.message,
      stack: error.stack.split('\n').slice(1)
    }, null, 2));
    console.log('**********');

    process.exit(1);
  }
})();