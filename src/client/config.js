const {
  CONTEXT: environment,
  PORT: port
} = process.env;

module.exports = {
  baseUrl: {
    production: 'https://axecharts.com',
    local: `http://localhost:${port || 8080}`,
    default: 'https://axe-charts.netlify.app'
  }[environment || 'default']
};