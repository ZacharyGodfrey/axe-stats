const sequentially = async (items, action) => {
  return items.reduce((prev, item, index) => {
    return prev.then(() => action(item, index));
  }, Promise.resolve());
};

const sum = (values) => values.reduce((t, v) => t + v, 0);

const round = (value, places) => {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
};

const roundForDisplay = (value) => isNaN(value) ? 0 : round(value, 2);

const average = (values) => sum(values) / Math.max(1, values.length);

const isDesiredResponse = (method, status, url) => {
  return (response) => {
    return response.request().method() === method
      && response.status() === status
      && response.url() === url;
  };
};

const reactPageState = (page, selector) => {
  const getState = (element) => {
    return element._reactRootContainer._internalRoot.current.memoizedState.element.props.store.getState();
  };

  return page.$eval(selector, getState);
};

const waitMilliseconds = (milliseconds) => {
  console.log(`Waiting for ${milliseconds} milliseconds...`);

  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

const logError = (error) => {
  console.log('**********');

  console.log(JSON.stringify({
    message: error.message,
    stack: error.stack.split('\n').slice(1)
  }, null, 2));

  console.log('**********');
};

const logErrorAndDefault = (defaultValue) => {
  return (error) => {
    logError(error);

    return defaultValue;
  };
};

module.exports = {
  db: require('./database'),
  sequentially,
  sum,
  round,
  roundForDisplay,
  average,
  isDesiredResponse,
  reactPageState,
  waitMilliseconds,
  logError,
  logErrorAndDefault
};