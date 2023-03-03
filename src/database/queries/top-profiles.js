module.exports = (db, count, sortField, sortOrder) => {
  const sql = `SELECT * FROM profiles ORDER BY ? ? LIMIT ?`;

  console.log(`Top Throwers: ${JSON.stringify(arguments, null, 2)}`);

  return db.query(sql, [sortField, sortOrder.toUpperCase(), count]);
};