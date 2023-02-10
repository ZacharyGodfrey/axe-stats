const serverless = require('serverless-http');

const createServer = require('../src/server');

let instance = null;

module.exports.handler = async (event, context) => {
  if (!instance) {
    const app = await createServer();

    instance = serverless(app);
  }

  return instance(event, context);
};