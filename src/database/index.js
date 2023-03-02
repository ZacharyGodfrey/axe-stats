const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/data.db`;

const topThrowers = require('./queries/top-throwers');
const getThrowerById = require('./queries/get-thrower-by-id');

let connection = null;

const db = {
  topThrowers: () => topThrowers.apply(null, [db, ...arguments]),
  getThrowerById: () => getThrowerById.apply(null, [db, ...arguments]),
  _connection: () => connection,
  connect: ({ destroyFileFirst = false }) => {
    if (!connection && destroyFileFirst === true) {
      console.log('Deleting database file before connecting...');

      fs.removeSync(FILE_NAME);
    }

    connection = connection || new sqlite3.Database(FILE_NAME, (error) => {
      if (error) {
        throw error;
      } else {
        console.log('Connected to the databse.');
      }
    });
  },
  query: (sql, params = []) => new Promise((resolve, reject) => {
    if (!connection) {
      reject(new Error('Not connected to the database.'));
    }

    console.log('Executing database query:');
    console.log(sql);
    console.log(`Params: ${JSON.stringify(params, null, 2)}`);

    connection.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  }),
  disconnect: () => {
    connection.close((error) => {
      if (error) {
        throw error;
      } else {
        console.log('Disconnected from the database.')
      }
    });

    connection = null;
  }
};

module.exports = db;