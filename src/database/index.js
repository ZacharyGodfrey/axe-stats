module.exports = async () => {
  // TODO: Add real database connection
  const connection = await Promise.resolve({});

  return {
    topThrowers: require('./queries/top-throwers')(connection),
    getThrowerById: require('./queries/get-thrower-by-id')(connection),
  };
};