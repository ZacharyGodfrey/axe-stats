const serverlessExpress = require('@vendia/serverless-express');

const createServer = require('../src/server');

let instance = null;

module.exports.handler = async (event, context) => {
  if (!instance) {
    const app = await createServer();

    instance = serverlessExpress({ app });
  }

  return instance(event, context);
};