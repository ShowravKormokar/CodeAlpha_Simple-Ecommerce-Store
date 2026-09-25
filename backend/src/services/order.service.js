// Order service — handles order creation inside a PostgreSQL transaction.
// The browser is never trusted for price, stock, or totals.
// All values are re-read from PostgreSQL and calculated server-side.

const pool = require("../config/database");
const { ORDER_COLUMNS: PRODUCT_COLUMNS } = require("./product.service");
const {
  calculateDeliveryWindow,
  isCancellableStatus,
  normalizePayment,
} = require("./order-lifecycle.service");

function normalizeDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}

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
     ORDER BY id ASC
     FOR UPDATE`,
    [productIds]
  );
  return result.rows;
}

// Create the order header inside the transaction.
async function insertOrder(
  userId,
  totalAmount,
  status,
  shippingInfo,
  payment,
  deliveryWindow,
  placedAt,
  client
) {
  const result = await client.query(
    `INSERT INTO orders (
        user_id,
        total_amount,
        status,
        shipping_name,
        shipping_email,
        shipping_phone,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        created_at,
        updated_at,
        estimated_delivery_from,
        estimated_delivery_to,
        payment_method,
        payment_status,
        payment_provider
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15, $16, $17, $18)
     RETURNING id, user_id, total_amount, status, created_at, updated_at,
       shipping_name, shipping_email, shipping_phone, shipping_address_line1,
       shipping_address_line2, shipping_city, shipping_state, shipping_postal_code,
       shipping_country, estimated_delivery_from, estimated_delivery_to,
       payment_method, payment_status, payment_provider`,
    [
      userId,
      totalAmount,
      status,
      shippingInfo.name || null,
      shippingInfo.email || null,
      shippingInfo.phone || null,
      shippingInfo.addressLine1 || null,
      shippingInfo.addressLine2 || null,
      shippingInfo.city || null,
      shippingInfo.state || null,
      shippingInfo.postalCode || null,
      shippingInfo.country || null,
      placedAt,
      deliveryWindow.from,
      deliveryWindow.to,
      payment.method,
      payment.status,
      payment.provider,
    ]
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

function normalizeCancellationReason(reason) {
  if (reason === undefined || reason === null) return null;

  if (typeof reason !== "string") {
    const error = new Error("Cancellation reason must be a string");
    error.status = 400;
    throw error;
  }

  const normalized = reason.trim();
  if (normalized.length > 500) {
    const error = new Error("Cancellation reason must be 500 characters or fewer");
    error.status = 400;
    throw error;
  }

  return normalized || null;
}

async function findLockedOrderForCancellation(orderId, userId, client) {
  const result = await client.query(
    `SELECT id, user_id, status
     FROM orders
     WHERE id = $1 AND user_id = $2
     FOR UPDATE`,
    [orderId, userId]
  );

  return result.rows[0] || null;
}

async function findLockedOrderItems(orderId, client) {
  const result = await client.query(
    `SELECT product_id, quantity
     FROM order_items
     WHERE order_id = $1
     ORDER BY product_id ASC
     FOR UPDATE`,
    [orderId]
  );

  return result.rows;
}

async function lockProductsForCancellation(productIds, client) {
  if (productIds.length === 0) return;

  const result = await client.query(
    `SELECT id
     FROM products
     WHERE id = ANY($1)
     ORDER BY id ASC
     FOR UPDATE`,
    [productIds]
  );

  if (result.rows.length !== productIds.length) {
    throw new Error("Order references a product that no longer exists");
  }
}

async function restoreStock(productId, quantity, client) {
  await client.query(
    `UPDATE products
     SET stock_quantity = stock_quantity + $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [quantity, productId]
  );
}

async function cancelOrder(orderId, userId, rawReason) {
  const orderIdNumber = Number(orderId);
  if (!Number.isInteger(orderIdNumber) || orderIdNumber <= 0) {
    const error = new Error("Invalid order ID");
    error.status = 400;
    throw error;
  }

  const reason = normalizeCancellationReason(rawReason);
  const client = await pool.connect();
  let committed = false;

  try {
    await client.query("BEGIN");

    const order = await findLockedOrderForCancellation(
      orderIdNumber,
      userId,
      client
    );

    if (!order) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    if (order.status === "cancelled") {
      await client.query("COMMIT");
      committed = true;
      return {
        order: await getOrderByIdAndUser(orderIdNumber, userId),
        alreadyCancelled: true,
      };
    }

    if (!isCancellableStatus(order.status)) {
      const error = new Error("Order cannot be cancelled in its current status");
      error.status = 409;
      throw error;
    }

    const items = await findLockedOrderItems(orderIdNumber, client);
    const productIds = [...new Set(items.map((item) => Number(item.product_id)))];
    await lockProductsForCancellation(productIds, client);

    for (const item of items) {
      await restoreStock(Number(item.product_id), Number(item.quantity), client);
    }

    await client.query(
      `UPDATE orders
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           cancelled_by_user_id = $2,
           cancellation_reason = $3,
           payment_status = CASE
             WHEN payment_status = 'PENDING' THEN 'CANCELLED'
             ELSE payment_status
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderIdNumber, userId, reason]
    );

    await client.query("COMMIT");
    committed = true;

    return {
      order: await getOrderByIdAndUser(orderIdNumber, userId),
      alreadyCancelled: false,
    };
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK").catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

async function createOrder(userId, rawItems, shippingInfo = {}, paymentInfo = {}) {
  const normalized = normalizeItems(rawItems);

  if (normalized.error) {
    const err = new Error(normalized.error);
    err.status = 400;
    throw err;
  }

  const shipping = shippingInfo && typeof shippingInfo === "object" && !Array.isArray(shippingInfo)
    ? shippingInfo
    : {};
  const payment = normalizePayment(paymentInfo);
  const items = normalized.items;
  const productIds = items.map((item) => item.productId);
  const placedAt = new Date();
  const deliveryWindow = calculateDeliveryWindow(placedAt);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const products = await findProductsByIds(productIds, client);
    const productMap = new Map(products.map((p) => [Number(p.id), p]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        const err = new Error(`Product not found: ID ${item.productId}`);
        err.status = 404;
        throw err;
      }
    }

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (item.quantity > Number(product.stock_quantity)) {
        const err = new Error(`Insufficient stock for ${product.name}`);
        err.status = 409;
        throw err;
      }
    }

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

    totalAmount = Math.round(totalAmount * 100) / 100;

    const order = await insertOrder(
      userId,
      totalAmount,
      "confirmed",
      shipping,
      payment,
      deliveryWindow,
      placedAt,
      client
    );

    const createdItems = [];
    for (const orderItem of orderItems) {
      const created = await createOrderItem(
        order.id,
        orderItem.productId,
        orderItem.quantity,
        orderItem.unitPrice,
        orderItem.subtotal,
        client
      );
      createdItems.push(created);
    }

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
        estimatedDeliveryFrom: normalizeDateOnly(order.estimated_delivery_from),
        estimatedDeliveryTo: normalizeDateOnly(order.estimated_delivery_to),
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        paymentProvider: order.payment_provider,
        cancelledAt: null,
        cancellationReason: null,
        shippingName: order.shipping_name,
        shippingEmail: order.shipping_email,
        shippingPhone: order.shipping_phone,
        shippingAddressLine1: order.shipping_address_line1,
        shippingAddressLine2: order.shipping_address_line2,
        shippingCity: order.shipping_city,
        shippingState: order.shipping_state,
        shippingPostalCode: order.shipping_postal_code,
        shippingCountry: order.shipping_country,
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

module.exports = {
  createOrder,
  cancelOrder,
  normalizeItems,
  getOrdersByUser,
  getOrderByIdAndUser,
};

// Return the authenticated user's order history, newest first.
async function getOrdersByUser(userId) {
  const result = await pool.query(
    `SELECT
        id,
        total_amount,
        status,
     created_at,
     updated_at,
     estimated_delivery_from,
     estimated_delivery_to,
     cancelled_at,
     cancelled_by_user_id,
     cancellation_reason,
     payment_method,
     payment_status,
     payment_provider,
     shipping_name,
        shipping_email,
        shipping_phone,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country
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
    estimatedDeliveryFrom: normalizeDateOnly(row.estimated_delivery_from),
    estimatedDeliveryTo: normalizeDateOnly(row.estimated_delivery_to),
    cancelledAt: row.cancelled_at,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider,
    shippingName: row.shipping_name,
    shippingEmail: row.shipping_email,
    shippingPhone: row.shipping_phone,
    shippingAddressLine1: row.shipping_address_line1,
    shippingAddressLine2: row.shipping_address_line2,
    shippingCity: row.shipping_city,
    shippingState: row.shipping_state,
    shippingPostalCode: row.shipping_postal_code,
    shippingCountry: row.shipping_country,
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
     updated_at,
     estimated_delivery_from,
     estimated_delivery_to,
     cancelled_at,
     cancelled_by_user_id,
     cancellation_reason,
     payment_method,
     payment_status,
     payment_provider,
     shipping_name,
        shipping_email,
        shipping_phone,
        shipping_address_line1,
        shipping_address_line2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country
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
        oi.id,
        oi.product_id,
        p.name AS product_name,
        oi.quantity,
        oi.unit_price,
        oi.subtotal,
        oi.rating,
        oi.rated_at
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
    estimatedDeliveryFrom: normalizeDateOnly(order.estimated_delivery_from),
    estimatedDeliveryTo: normalizeDateOnly(order.estimated_delivery_to),
    cancelledAt: order.cancelled_at,
    cancelledByUserId: order.cancelled_by_user_id,
    cancellationReason: order.cancellation_reason,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    paymentProvider: order.payment_provider,
    shippingName: order.shipping_name,
    shippingEmail: order.shipping_email,
    shippingPhone: order.shipping_phone,
    shippingAddressLine1: order.shipping_address_line1,
    shippingAddressLine2: order.shipping_address_line2,
    shippingCity: order.shipping_city,
    shippingState: order.shipping_state,
    shippingPostalCode: order.shipping_postal_code,
    shippingCountry: order.shipping_country,
    items: itemsResult.rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      subtotal: row.subtotal,
      rating: row.rating,
      ratedAt: row.rated_at,
    })),
  };
}