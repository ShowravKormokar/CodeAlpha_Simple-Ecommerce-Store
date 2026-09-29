// Base schema bootstrap for a fresh database.
//
// Applies database/schema.sql only when the core tables are missing, so it is safe
// to run on every container start. It never drops, truncates or deletes anything:
// once the schema exists this script does nothing and leaves existing data alone.
//
// This exists because the migration runner (scripts/run-migrations.js) assumes the
// base schema is already present. Local development applies schema.sql by hand; the
// Docker setup needs it to happen automatically.

const fs = require("fs");
const path = require("path");
const pool = require("../src/config/database");

const SCHEMA_FILE = path.join(__dirname, "..", "database", "schema.sql");
const CORE_TABLES = ["users", "products", "orders", "order_items"];
const MAX_ATTEMPTS = 30;
const RETRY_DELAY_MS = 2000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      console.log(
        `[schema] waiting for PostgreSQL (attempt ${attempt}/${MAX_ATTEMPTS}): ${error.message}`
      );
      await delay(RETRY_DELAY_MS);
    }
  }
}

async function coreTablesExist() {
  const { rows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [CORE_TABLES]
  );
  return rows.length === CORE_TABLES.length;
}

async function applySchema() {
  if (await coreTablesExist()) {
    console.log("[schema] base schema already present, nothing to do");
    return;
  }

  console.log("[schema] applying database/schema.sql");
  const sql = fs.readFileSync(SCHEMA_FILE, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[schema] base schema applied");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  await connect();
  await applySchema();
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("[schema] FAILED:", error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
