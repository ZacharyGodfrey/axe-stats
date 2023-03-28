const sum = (values) => values.reduce((result, value) => result + value, 0);

const average = (set) => sum(set) / set.length;

const round = (value, places = 0) => {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
};

const ordinal = (value) => {
  switch (true) {
    case value <= 0: return '';
    case value % 10 === 1: return `${value}st`;
    case value % 10 === 2: return `${value}nd`;
    case value % 10 === 3: return `${value}rd`;
    default: return `${value}th`;
  }
};

module.exports = {
  sum,
  average,
  round,
  ordinal,
  readFile: require('./read-file'),
  render: require('./render'),
}