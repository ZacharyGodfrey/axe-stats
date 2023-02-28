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
  query: (sql, params = []) => {
    if (!connection) {
      throw new Error('Not connected to the database.');
    }

    let results = [];

    connection.all(sql, params, (error, rows) => {
      if (error) {
        throw error;
      } else {
        results = rows;
      }
    });

    return results;
  },
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