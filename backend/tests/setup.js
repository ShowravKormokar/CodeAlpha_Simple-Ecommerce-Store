require("dotenv").config();
const { execSync } = require("child_process");
const pool = require("../src/config/database");

beforeAll(async () => {
  try {
    execSync("node scripts/run-migrations.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });
  } catch (e) {
    // Migrations may have already been applied; this is not a failure
    process.stderr.write("[setup] migrations warning: " + e.message + "\n");
  }

  try {
    execSync("node scripts/seed.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });
  } catch (e) {
    process.stderr.write("[setup] seed warning: " + e.message + "\n");
  }

  // Create a test user for order tests
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    ["test@example.com"]
  );

  if (existing.rows.length === 0) {
    await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
      ["Test User", "test@example.com", "$2a$10$testhash"]
    );
  }
});

afterAll(async () => {
  // Clean up test orders and order items
  try {
    await pool.query("DELETE FROM order_items USING orders WHERE order_items.order_id = orders.id AND orders.user_id = (SELECT id FROM users WHERE email = $1)", ["test@example.com"]);
    await pool.query("DELETE FROM orders WHERE user_id = (SELECT id FROM users WHERE email = $1)", ["test@example.com"]);
    await pool.query("DELETE FROM users WHERE email = $1", ["test@example.com"]);
  } catch (e) {
    process.stderr.write("[setup] cleanup warning: " + e.message + "\n");
  }

  // Restore stock for products that may have been affected by order tests
  try {
    await pool.query(`
      UPDATE products SET stock_quantity = (
        CASE id
          WHEN 3 THEN 100
          ELSE stock_quantity
        END
      )
    `);
  } catch (e) {
    process.stderr.write("[setup] stock restore warning: " + e.message + "\n");
  }

  await pool.end();
});
