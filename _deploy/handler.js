const serverless = require('serverless-http');

const db = require('../src/database');
const client = require('../src/client');
const server = require('../src/server');

db.connect();

module.exports.handler = serverless(server(db, client));