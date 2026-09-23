// Migration runner — applies SQL files from backend/database/migrations/ in order.
// Safe to run multiple times: each migration is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

const pool = require("../src/config/database");
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "database", "migrations");

async function runMigrations() {
  // Ensure tracking table exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await pool.query(
      "SELECT 1 FROM _migrations WHERE name = $1",
      [file]
    );
    if (already.rows.length > 0) {
      console.log(`[migration] skipped (already applied): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO _migrations (name) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      console.log(`[migration] applied: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`[migration] FAILED: ${file}`, error.message);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }
}

runMigrations().catch((error) => {
  console.error("Migration runner error:", error.message);
  process.exit(1);
});