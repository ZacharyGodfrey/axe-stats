const serverless = require('serverless-http');

const db = require('../src/database')();
const client = require('../src/client');
const server = require('../src/server');

module.exports.handler = serverless(server(db, client));