const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/data.db`;

const topThrowers = require('./queries/top-throwers');
const getThrowerById = require('./queries/get-thrower-by-id');
const timestamp = require('./queries/timestamp');

let connection = null;

module.exports = ({ destroyFileFirst }) => {
  const db = {
    topThrowers: () => topThrowers.apply(null, [db, ...arguments]),
    getThrowerById: () => getThrowerById.apply(null, [db, ...arguments]),
    timestamp: () => timestamp.apply(null, [db, ...arguments]),
    _connection: () => connection,
    connect: () => connection ? Promise.resolve() : new Promise((resolve, reject) => {
      if (destroyFileFirst === true) {
        console.log('Deleting database file before connecting...');

        fs.removeSync(FILE_NAME);

        console.log(`Deleted: ${FILE_NAME}`);
      }

      connection = new sqlite3.Database(FILE_NAME, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log('Connected to the databse.');

          resolve();
        }
      });
    }),
    query: (sql, params = []) => {
      return db.connect().then(() => {
        return new Promise((resolve, reject) => {
          console.log('Executing database query:');
          console.log(sql);
          console.log(`Params: ${JSON.stringify(params, null, 2)}`);

          connection.all(sql, params, (error, rows) => {
            if (error) {
              reject(error);
            } else {
              resolve(rows);
            }
          });
        });
      });
    },
    disconnect: () => !connection ? Promise.resolve() : new Promise((resolve, reject) => {
      connection.close((error) => {
        if (error) {
          reject(error);
        } else {
          connection = null;

          console.log('Disconnected from the database.');

          resolve();
        }
      });
    })
  };

  return db;
};