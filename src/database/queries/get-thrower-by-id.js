module.exports = (db, id) => {
  const sql = `SELECT * FROM profiles WHERE urlId = ?;`;

  return db.query(sql, [id])[0] || null;
};