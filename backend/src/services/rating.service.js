// Rating service — handles submission of 1–5 star ratings on order items.
// All ownership, status, and immutability checks happen server-side.
// The rating update uses a safe conditional UPDATE so a race cannot overwrite
// an already-rated row.

const pool = require("../config/database");

// Validate the incoming rating value.
// Accepts only integers 1–5.
function parseRating(value) {
  if (value === undefined || value === null) {
    return { error: "Rating is required" };
  }

  // Reject strings, booleans, objects, arrays.
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { error: "Rating must be an integer between 1 and 5" };
  }

  if (value < 1 || value > 5) {
    return { error: "Rating must be an integer between 1 and 5" };
  }

  return { rating: value };
}

// Submit a rating for a specific order item.
// Security checks (all must pass):
//   1. User is authenticated (req.userId already set by auth middleware).
//   2. Order exists and belongs to the authenticated user.
//   3. Order status is 'completed'.
//   4. Order item belongs to that order.
//   5. Order item has not already been rated (rating IS NULL).
//
// The UPDATE uses a conditional WHERE clause so a second concurrent request
// cannot overwrite an existing rating — it simply affects zero rows.
async function submitRating(userId, orderId, orderItemId, ratingValue) {
  // 1. Validate rating value.
  const parsed = parseRating(ratingValue);
  if (parsed.error) {
    const err = new Error(parsed.error);
    err.status = 400;
    throw err;
  }
  const rating = parsed.rating;

  // 2. Validate IDs.
  const orderIdNum = Number(orderId);
  const orderItemIdNum = Number(orderItemId);

  if (!Number.isInteger(orderIdNum) || orderIdNum <= 0) {
    const err = new Error("Invalid order ID");
    err.status = 400;
    throw err;
  }

  if (!Number.isInteger(orderItemIdNum) || orderItemIdNum <= 0) {
    const err = new Error("Invalid order item ID");
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Fetch the order item joined with its order, locking the row.
    //    This prevents concurrent submissions from both passing the check.
    const itemResult = await client.query(
      `SELECT
          oi.id          AS order_item_id,
          oi.order_id    AS order_id,
          oi.product_id  AS product_id,
          oi.rating      AS rating,
          oi.rated_at    AS rated_at,
          o.user_id      AS owner_user_id,
          o.status       AS order_status
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.id = $1
       FOR UPDATE`,
      [orderItemIdNum]
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");
      const err = new Error("Order item not found");
      err.status = 404;
      throw err;
    }

    const row = itemResult.rows[0];

    // 4. Verify ownership.
    if (Number(row.owner_user_id) !== Number(userId)) {
      await client.query("ROLLBACK");
      const err = new Error("Order not found");
      err.status = 404;
      throw err;
    }

    // 5. Verify order status is completed.
    if (row.order_status !== "completed") {
      await client.query("ROLLBACK");
      const err = new Error("Only completed orders can be rated");
      err.status = 409;
      throw err;
    }

    // 6. Verify not already rated.
    if (row.rating !== null) {
      await client.query("ROLLBACK");
      const err = new Error("This order item has already been rated");
      err.status = 409;
      throw err;
    }

    // 7. Safe conditional update — only rows with rating IS NULL are affected.
    const updateResult = await client.query(
      `UPDATE order_items
          SET rating = $1,
              rated_at = NOW()
        WHERE id = $2
          AND rating IS NULL
        RETURNING id, rating, rated_at`,
      [rating, orderItemIdNum]
    );

    await client.query("COMMIT");

    // Should always have a row because we already verified rating IS NULL
    // under the row lock, but guard against unexpected zero-row updates.
    if (updateResult.rows.length === 0) {
      const err = new Error("This order item has already been rated");
      err.status = 409;
      throw err;
    }

    const updated = updateResult.rows[0];

    return {
      orderItemId: updated.id,
      rating: updated.rating,
      ratedAt: updated.rated_at,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Calculate average rating and count for a single product.
// Only rows with rating IS NULL are excluded (NULL ratings are not counted).
async function getProductRatingSummary(productId) {
  const productIdNum = Number(productId);

  if (!Number.isInteger(productIdNum) || productIdNum <= 0) {
    const err = new Error("Invalid product ID");
    err.status = 400;
    throw err;
  }

  const result = await pool.query(
    `SELECT
        COUNT(*)              AS rating_count,
        COALESCE(AVG(rating), 0) AS average_rating
     FROM order_items
     WHERE product_id = $1
       AND rating IS NOT NULL`,
    [productIdNum]
  );

  const row = result.rows[0];
  const count = Number(row.rating_count);
  // Round average to 1 decimal place for display.
  const average = count > 0
    ? Math.round(Number(row.average_rating) * 10) / 10
    : 0;

  return {
    average,
    count,
  };
}

module.exports = { submitRating, getProductRatingSummary, parseRating };