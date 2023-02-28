module.exports = (id) => {
  const sql = `SELECT * FROM profiles WHERE urlId = ?;`;

  return this.query(sql, [id])[0] || null;
};