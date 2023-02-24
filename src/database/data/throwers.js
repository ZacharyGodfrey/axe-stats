module.exports = Array.from({ length: 25 }).fill().map((_, index) => {
  return {
    id: 100 + index,
    name: `Thrower ${index + 1}`,
    rank: index + 1,
    standardRating: 1500 - (index * 10),
    premierRating: 1600 - (index * 8)
  }
});