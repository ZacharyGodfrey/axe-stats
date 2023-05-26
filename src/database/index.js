const sqlite3 = require('sqlite3').verbose();

const FILE_NAME = `${__dirname}/data.db`;
let connection = null;

const connect = () => connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection = new sqlite3.Database(FILE_NAME, (error) => {
    if (error) {
      reject(error);
    } else {
      console.log('[DATABASE] Connected to the databse.');

      resolve();
    }
  });
});

const run = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  console.log(`[DB:Run]\n${sql}`);

  connection.run(sql, params, (error) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
}));

const query = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  console.log(`[DB:Query]\n${sql}`);

  connection.all(sql, params, (error, rows) => {
    if (error) {
      reject(error);
    } else {
      resolve(rows);
    }
  });
}));

const get = (sql, params = []) => connect().then(() => new Promise((resolve, reject) => {
  console.log(`[DB:Get]\n${sql}`);

  connection.get(sql, params, (error, row) => {
    if (error) {
      reject(error);
    } else {
      resolve(row);
    }
  });
}));

const disconnect = () => !connection ? Promise.resolve() : new Promise((resolve, reject) => {
  connection.close((error) => {
    if (error) {
      reject(error);
    } else {
      connection = null;

      console.log('[DATABASE] Disconnected from the database.');

      resolve();
    }
  });
});

module.exports = {
  _fileName: FILE_NAME,
  connect,
  run,
  query,
  get,
  disconnect
};