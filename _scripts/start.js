const createServer = require('../src/server');

const port = process.env.PORT || 8080;

(async () => {
  const server = await createServer();

  server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
})();