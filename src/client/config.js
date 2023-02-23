const {
  NODE_ENV: environment,
  PORT: port
} = process.env;

const isProd = environment === 'production';
const prodUrl = 'https://axe-charts.netlify.app'; // https://axecharts.com
const localUrl = `http://localhost:${port}`;

module.exports = {
  baseUrl: isProd ? prodUrl : localUrl
};