const byAscending = (fn) => (left, right) => {
  const l = fn(left), r = fn(right);

  return l < r ? -1 : l > r ? 1 : 0;
};

const byDescending = (fn) => (left, right) => {
  const l = fn(left), r = fn(right);

  return r < l ? -1 : r > l ? 1 : 0;
};

module.exports = {
  byAscending,
  byDescending
};