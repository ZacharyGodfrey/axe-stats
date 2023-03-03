const db = require('../src/database');
const client = require('../src/client');
const server = require('../src/server');

const port = process.env.PORT || 8080;

server(db, client).listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});