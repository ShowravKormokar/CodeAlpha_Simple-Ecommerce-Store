const { execSync } = require("child_process");
const pool = require("../src/config/database");

describe("Seed Idempotency", () => {
  const PRODUCT_COUNT_QUERY = "SELECT COUNT(*) FROM products";
  const PRODUCT_IDS_QUERY = "SELECT id, name, price, stock_quantity FROM products ORDER BY id";

  it("should have 12 products after initial seed", async () => {
    const result = await pool.query(PRODUCT_COUNT_QUERY);
    const count = Number(result.rows[0].count);
    expect(count).toBe(12);
  });

  it("should not create duplicates when seed is run again", async () => {
    const beforeCount = await pool.query(PRODUCT_COUNT_QUERY);
    const beforeNum = Number(beforeCount.rows[0].count);

    execSync("node scripts/seed.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });

    const afterCount = await pool.query(PRODUCT_COUNT_QUERY);
    const afterNum = Number(afterCount.rows[0].count);

    expect(afterNum).toBe(beforeNum);
  });

  it("should preserve existing product IDs after re-seed", async () => {
    const before = await pool.query(PRODUCT_IDS_QUERY);
    const beforeIds = before.rows.map((r) => r.id);

    execSync("node scripts/seed.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });

    const after = await pool.query(PRODUCT_IDS_QUERY);
    const afterIds = after.rows.map((r) => r.id);

    expect(afterIds).toEqual(beforeIds);
  });

  it("should preserve existing product names after re-seed", async () => {
    const before = await pool.query(PRODUCT_IDS_QUERY);
    const beforeNames = before.rows.map((r) => r.name);

    execSync("node scripts/seed.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });

    const after = await pool.query(PRODUCT_IDS_QUERY);
    const afterNames = after.rows.map((r) => r.name);

    expect(afterNames).toEqual(beforeNames);
    expect(afterNames).toContain("Wireless Mouse");
    expect(afterNames).toContain("Mechanical Keyboard");
  });

  it("should preserve existing stock values after re-seed", async () => {
    const before = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id = 3"
    );
    const beforeStock = Number(before.rows[0].stock_quantity);

    execSync("node scripts/seed.js", {
      cwd: __dirname + "/..",
      stdio: "pipe",
    });

    const after = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id = 3"
    );
    const afterStock = Number(after.rows[0].stock_quantity);

    // Seed sets stock to the same value, so it should be the same
    expect(afterStock).toBe(beforeStock);
  });

  it("should enrich all products with new fields", async () => {
    const fields = [
      "slug", "sku", "brand", "category", "regular_price",
      "offer_sale", "is_active", "is_featured",
      "colors", "sizes", "specifications", "tags",
    ];

    for (const field of fields) {
      const result = await pool.query(
        `SELECT COUNT(*) FROM products WHERE ${field} IS NOT NULL OR ${field}::TEXT IS NOT NULL`
      );
      const count = Number(result.rows[0].count);
      expect(count).toBe(12);
    }
  });

  it("should have valid SLUGs for all products", async () => {
    const result = await pool.query("SELECT id, slug FROM products ORDER BY id");

    result.rows.forEach((row) => {
      expect(row.slug).not.toBeNull();
      expect(row.slug.length).toBeGreaterThan(0);
      expect(row.slug).not.toContain(" ");
    });
  });

  it("should have unique SKUs for all products", async () => {
    const result = await pool.query(
      "SELECT sku, COUNT(*) FROM products WHERE sku IS NOT NULL GROUP BY sku HAVING COUNT(*) > 1"
    );
    expect(result.rowCount).toBe(0);
  });
});
