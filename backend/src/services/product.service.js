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

async function getProducts() {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
     FROM products
     ORDER BY id ASC`
  );
  return result.rows;
}

async function getProductById(id) {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
     FROM products
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { getProducts, getProductById };