module.exports = (db, count, type) => {
  const sql = `SELECT * FROM profiles ORDER BY ? DESC LIMIT ?`;

  console.log(`Top Throwers: ${count} ${type}`);

  return db.query(sql, [
    type === 'premier' ? 'premierRating' : 'standardRating',
    count
  ]);
};