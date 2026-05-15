const client = require("../tursoClient");

async function createUser({ id, name, email, hashedPassword }) {
  await client.execute({
    sql: `INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)`,
    args: [id, name, email, hashedPassword],
  });
}

async function getUserByEmail(email) {
  const result = await client.execute({
    sql: `SELECT * FROM users WHERE email = ? LIMIT 1`,
    args: [email],
  });
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await client.execute({
    sql: `SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1`,
    args: [id],
  });
  return result.rows[0] || null;
}

module.exports = { createUser, getUserByEmail, getUserById };