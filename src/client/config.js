const {
  NODE_ENV: environment,
  PORT: port,
  URL: currentUrl
} = process.env;

module.exports = {
  environment,
  currentUrl,
  baseUrl: {
    production: 'https://axecharts.com',
    local: `http://localhost:${port || 8080}`,
    default: 'https://axe-charts.netlify.app'
  }[environment || 'default']
};