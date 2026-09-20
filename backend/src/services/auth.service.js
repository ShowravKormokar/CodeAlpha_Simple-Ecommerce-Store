const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function createToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    "SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function createUser(name, email, password) {
  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at, updated_at`,
    [name, email, passwordHash]
  );

  return result.rows[0];
}

async function emailExists(email) {
  const result = await pool.query(
    "SELECT 1 FROM users WHERE email = $1",
    [email]
  );
  return result.rowCount > 0;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  findUserByEmail,
  findUserById,
  createUser,
  emailExists,
};