module.exports = async (db) => {
  const [row] = await db.query(`SELECT * FROM timestamp;`);

  return row.timestamp;
};