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
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', '*');
		res.header('Access-Control-Allow-Methods', 'OPTIONS,GET,POST');
		res.header('x-powered-by', '');

		method === 'OPTIONS' ? res.status(200).end() : next();
	});

	server.get('/', async (req, res, next) => {
		const user = null;
		const body = await client.home(db, user);

		res.status(200).type('html').send(body);
	});

	server.use((_, res) => {
		res.status(404).type('text').send('404 Not Found');
	});

	return server;
};