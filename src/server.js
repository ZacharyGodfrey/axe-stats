const express = require('express');

const database = require('./database');
const client = require('./client');

const pageHandler = async (pageName, db, req, res, next) => {
  try {
    if (!client[pageName]) {
      return next();
    }

    const body = await client[pageName](db);

    return res.status(200).type('html').send(body);
  } catch (error) {
    return res.status(500).type('html').send(error.message);
  }
};

module.exports = async () => {
  const db = await database();
  const server = express();

  server.set('json spaces', 2);
  server.use(express.urlencoded({ extended: false }));
  server.use(express.json());

  server.use(({ method }, res, next) => {
    res.header('x-powered-by', '');

    return method === 'OPTIONS' ? res.status(200).end() : next();
  });

  server.get('/', (req, res, next) => pageHandler('home', db, req, res, next));

  server.get('/:page', (req, res, next) => pageHandler(req.params.page, db, req, res, next));

  server.use((req, res, next) => pageHandler('not-found', db, req, res, next));

  server.use((req, res, next) => res.status(404).send('Hard Stop'));

  return server;
};