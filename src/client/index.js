module.exports = [
  require('./pages/home')
].reduce((pages, { route, render }) => ({ ...pages, [route]: render }), {});