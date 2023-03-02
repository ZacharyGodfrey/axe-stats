const {
  URL: baseUrl
} = process.env;

module.exports = {
  baseUrl,
  updatedAt: new Date().toISOString()
};