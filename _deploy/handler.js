const serverless = require('serverless-http');

const createServer = require('../src/server');

let instance = null;

module.exports.handler = async (event, context) => {
  instance = instance || serverless(await createServer());

  return instance(event, context);
};