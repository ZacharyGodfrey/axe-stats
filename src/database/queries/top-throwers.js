module.exports = (db, count, type) => {
  const sql = `SELECT * FROM profiles ORDER BY ? DESC LIMIT ?`;

  console.log(`Top Throwers: ${JSON.stringify(arguments, null, 2)}`);

  return db.query(sql, [
    type === 'premier' ? 'premierRating' : 'standardRating',
    count
  ]);
};