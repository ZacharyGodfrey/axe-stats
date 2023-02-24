const express = require('express');

const createDatabase = require('./database');
const client = require('./client');
const createRouter = require('./router');

module.exports = async () => {
  const db = await createDatabase();
  const router = createRouter(client, db);
  const server = express();

  server.set('json spaces', 2);
  server.use(express.urlencoded({ extended: false }));
  server.use(express.json());

  server.use(({ method }, res, next) => {
    res.header('x-powered-by', '');

    return method === 'OPTIONS' ? res.status(200).end() : next();
  });

  // server.get('/', (req, res, next) => router('home', req, res, next, 200));

  // server.get('/:page', (req, res, next) => router(req.params.page, req, res, next, 200));

  server.use(({ method, path, body }, res, next) => {
    const message = 'Hard Stop: No routes matched the request.';

    return res.status(404).send({ message, method, path, body });
  });

  return server;
};