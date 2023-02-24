const express = require('express');

const createDatabase = require('./database');
const client = require('./client');

const handler = (action) => {
  return async (req, res, next) => {
    try {
      const { status, html } = await action(req);

      return res.status(status).type('html').send(html);
    } catch (error) {
      return res.status(500).type('text').send('An internal server error has occurred.');
    }
  };
};

module.exports = async () => {
  const db = await createDatabase();
  const server = express();

  server.set('json spaces', 2);
  server.use(express.urlencoded({ extended: false }));
  server.use(express.json());

  server.use(({ method }, res, next) => {
    res.header('x-powered-by', '');

    return method === 'OPTIONS' ? res.status(200).end() : next();
  });

  server.get('/s/compare/:leftId/:rightId', handler(async (req) => {
    const { leftId, rightId } = req.params;
    const html = await client.compare(db, leftId, rightId);

    return { status: 200, html };
  }));

  server.use(({ method, path, query, body }, res, next) => {
    const message = 'Hard Stop: No routes matched the request.';

    return res.status(404).send({ message, method, path, query, body });
  });

  return server;
};