// Database bootstrap for a fresh environment.
//
//   npm run db:setup
//
// Runs the existing, authoritative scripts in the right order and stops as soon as
// one of them fails:
//
//   1. apply-base-schema.js  database/schema.sql, only if the core tables are missing
//   2. run-migrations.js     the tracked migrations, which skip anything already applied
//   3. seed.js               only when the products table is empty
//
// The seed step is deliberately conditional. Re-running it on every container start
// would overwrite product edits made in a local database. Nothing here drops,
// truncates or deletes: on an existing database this script is a no-op.
//
// The Docker `db-init` service runs exactly this script.

const { spawnSync } = require("child_process");
const path = require("path");
const pool = require("../src/config/database");

const SCRIPTS = path.join(__dirname);

function runScript(file) {
  console.log(`[db:setup] running ${file}`);
  const result = spawnSync(process.execPath, [path.join(SCRIPTS, file)], {
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${file} exited with code ${result.status}`);
  }
}

async function productCount() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM products");
  return rows[0].count;
}

async function main() {
  runScript("apply-base-schema.js");
  runScript("run-migrations.js");

  const existing = await productCount();

  if (existing > 0) {
    console.log(
      `[db:setup] ${existing} products already present, skipping the seed step`
    );
    return;
  }

  console.log("[db:setup] product table is empty, applying seed data");
  runScript("seed.js");
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error("[db:setup] FAILED:", error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  });
