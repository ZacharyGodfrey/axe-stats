const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = './data.db';

const topThrowers = require('./queries/top-throwers');
const getThrowerById = require('./queries/get-thrower-by-id');

let connection = null;

const db = {
  topThrowers: () => topThrowers.apply(null, [db, ...arguments]),
  getThrowerById: () => getThrowerById.apply(null, [db, ...arguments]),
  _connection: () => connection,
  connect: () => {
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