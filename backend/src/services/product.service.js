const pool = require("../config/database");

const PRODUCT_COLUMNS = [
  "id",
  "name",
  "description",
  "price",
  "image_url",
  "stock_quantity",
  "created_at",
  "updated_at",
];

// Calculate average rating and count for a single product.
// Only rows with rating IS NOT NULL are counted.
async function getProductRatingSummary(productId) {
  const result = await pool.query(
    `SELECT
        COUNT(*)              AS rating_count,
        COALESCE(AVG(oi.rating), 0) AS average_rating
     FROM order_items oi
     WHERE oi.product_id = $1
       AND oi.rating IS NOT NULL`,
    [productId]
  );

  const row = result.rows[0];
  const count = Number(row.rating_count);
  const average = count > 0
    ? Math.round(Number(row.average_rating) * 10) / 10
    : 0;

  return { average, count };
}

// Attach rating summaries to each product in a list.
async function attachRatingSummaries(products) {
  if (!products || products.length === 0) return products;

  const summaries = await Promise.all(
    products.map((p) => getProductRatingSummary(p.id))
  );

  return products.map((product, index) => ({
    ...product,
    rating: summaries[index],
  }));
}

async function getProducts() {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
      FROM products
      ORDER BY id ASC`
  );

  return attachRatingSummaries(result.rows);
}

async function getProductById(id) {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
      FROM products
      WHERE id = $1`,
    [id]
  );

  const product = result.rows[0] || null;
  if (!product) return null;

  const summary = await getProductRatingSummary(id);
  return { ...product, rating: summary };
}

module.exports = { getProducts, getProductById };