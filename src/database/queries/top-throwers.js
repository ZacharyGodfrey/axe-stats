module.exports = (count, type) => {
  const sql = `SELECT * FROM profiles ORDER BY ? DESC LIMIT ?`;

  return this.query(sql, [
    type === 'premier' ? 'premierRating' : 'standardRating',
    count
  ]);
};