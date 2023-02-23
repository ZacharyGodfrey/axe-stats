const {
  NODE_ENV: environment,
  PORT: port,
  URL: currentUrl
} = process.env;

module.exports = {
  environment,
  currentUrl,
  baseUrl: currentUrl || `http://localhost:${port || 8080}`
};