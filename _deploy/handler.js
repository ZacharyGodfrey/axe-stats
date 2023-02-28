const serverless = require('serverless-http');

const server = require('../src/server');

module.exports.handler = serverless(server);