// Seed runner — executes database/seed.sql against the configured PostgreSQL database.
// The seed SQL uses INSERT ... ON CONFLICT (sku) DO UPDATE SET, so it is idempotent.
// Running `npm run seed` multiple times will not create duplicate products.

const pool = require("../src/config/database");
const fs = require("fs");
const path = require("path");

const SEED_FILE = path.join(__dirname, "..", "database", "seed.sql");

async function runSeed() {
  const sql = fs.readFileSync(SEED_FILE, "utf8");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[seed] seed data applied successfully");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[seed] FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await pool.end();
}

runSeed().catch((error) => {
  console.error("Seed runner error:", error.message);
  process.exit(1);
});
