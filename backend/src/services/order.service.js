// Order service — handles order creation inside a PostgreSQL transaction.
// The browser is never trusted for price, stock, or totals.
// All values are re-read from PostgreSQL and calculated server-side.

const pool = require("../config/database");

const PRODUCT_COLUMNS = ["id", "name", "price", "stock_quantity"];

// Normalize and validate the incoming items array.
// Merges duplicate product IDs into a single entry.
function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Cart is empty" };
  }

  const merged = new Map();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: "Invalid cart item" };
    }

    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      return { error: "Invalid product ID" };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "Quantity must be a positive integer" };
    }

    const existing = merged.get(productId) || 0;
    merged.set(productId, existing + quantity);
  }

  return {
    items: [...merged.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
  };
}

// Read and lock requested product rows for the duration of the transaction.
async function findProductsByIds(productIds, client) {
  const result = await client.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
     FROM products
     WHERE id = ANY($1)
     FOR UPDATE`,
    [productIds]
  );
  return result.rows;
}

// Create the order header inside the transaction.
async function insertOrder(userId, totalAmount, status, client) {
  const result = await client.query(
    `INSERT INTO orders (user_id, total_amount, status)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, total_amount, status, created_at, updated_at`,
    [userId, totalAmount, status]
  );
  return result.rows[0];
}

// Create one order item inside the transaction.
async function createOrderItem(
  orderId,
  productId,
  quantity,
  unitPrice,
  subtotal,
  client
) {
  const result = await client.query(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, order_id, product_id, quantity, unit_price, subtotal`,
    [orderId, productId, quantity, unitPrice, subtotal]
  );
  return result.rows[0];
}

// Decrease stock for a product inside the transaction.
async function decreaseStock(productId, quantity, client) {
  const result = await client.query(
    `UPDATE products
     SET stock_quantity = stock_quantity - $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, stock_quantity`,
    [quantity, productId]
  );
  return result.rows[0];
}

// Main order creation flow.
// Runs entirely inside a single PostgreSQL transaction.
async function createOrder(userId, rawItems) {
  const normalized = normalizeItems(rawItems);

  if (normalized.error) {
    const err = new Error(normalized.error);
    err.status = 400;
    throw err;
  }

  const items = normalized.items;
  const productIds = items.map((item) => item.productId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock and read current product data.
    const products = await findProductsByIds(productIds, client);
    const productMap = new Map(products.map((p) => [Number(p.id), p]));

    // Validate existence.
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        const err = new Error(`Product not found: ID ${item.productId}`);
        err.status = 404;
        throw err;
      }
    }

    // Validate stock.
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (item.quantity > Number(product.stock_quantity)) {
        const err = new Error(
          `Insufficient stock for ${product.name}`
        );
        err.status = 409;
        throw err;
      }
    }

    // Authoritative price calculation.
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      const unitPrice = Number(product.price);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      });
    }

    // Round to 2 decimal places to match NUMERIC(10,2).
    totalAmount = Math.round(totalAmount * 100) / 100;

    // Create order header.
    const order = await insertOrder(
      userId,
      totalAmount,
      "confirmed",
      client
    );

    // Create order items.
    const createdItems = [];
    for (const oi of orderItems) {
      const created = await createOrderItem(
        order.id,
        oi.productId,
        oi.quantity,
        oi.unitPrice,
        oi.subtotal,
        client
      );
      createdItems.push(created);
    }

    // Decrease stock.
    for (const item of items) {
      await decreaseStock(item.productId, item.quantity, client);
    }

    await client.query("COMMIT");

    return {
      order: {
        id: order.id,
        userId: order.user_id,
        totalAmount: order.total_amount,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
      items: createdItems,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createOrder, normalizeItems, getOrdersByUser, getOrderByIdAndUser };

// Return the authenticated user's order history, newest first.
async function getOrdersByUser(userId) {
  const result = await pool.query(
    `SELECT
        id,
        total_amount,
        status,
        created_at,
        updated_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    totalAmount: row.total_amount,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Return a single order with its items, enforcing ownership.
// Returns null if the order does not exist or does not belong to the user.
async function getOrderByIdAndUser(orderId, userId) {
  const orderResult = await pool.query(
    `SELECT
        id,
        user_id,
        total_amount,
        status,
        created_at,
        updated_at
     FROM orders
     WHERE id = $1
       AND user_id = $2`,
    [orderId, userId]
  );

  if (orderResult.rows.length === 0) {
    return null;
  }

  const order = orderResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT
        oi.product_id,
        p.name AS product_name,
        oi.quantity,
        oi.unit_price,
        oi.subtotal
     FROM order_items oi
     JOIN products p
       ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [order.id]
  );

  return {
    id: order.id,
    userId: order.user_id,
    totalAmount: order.total_amount,
    status: order.status,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: itemsResult.rows.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      subtotal: row.subtotal,
    })),
  };
}