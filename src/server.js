const express = require('express');

const database = require('./database');
const client = require('./client');

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

  server.get('/:page', async (req, res, next) => {
    try {
      const page = req.params.page;

      console.log(`Requested Page: ${page || '(falsy)'}`);

      if (!client[page]) {
        return next();
      }

      const body = await client[page](db);

      return res.status(200).type('html').send(body);
    } catch (error) {
      return res.status(500).type('html').send('');
    }
  });

  server.use((req, res) => {
    const { method, originalUrl: url, body } = req;

    return res.status(404).send({ method, url, body });
  });

  return server;
};