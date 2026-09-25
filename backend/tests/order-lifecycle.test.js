const jwt = require("jsonwebtoken");
const request = require("supertest");
const { app } = require("../src/app");
const pool = require("../src/config/database");
const orderService = require("../src/services/order.service");
const {
  addWorkingDays,
  calculateDeliveryWindow,
  isCancellableStatus,
  normalizePayment,
} = require("../src/services/order-lifecycle.service");

describe("Order lifecycle and cancellation", () => {
  let userId;
  let otherUserId;
  let originalStock = {};

  beforeAll(async () => {
    const owner = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      ["test@example.com"]
    );
    userId = owner.rows[0]?.id;

    const other = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      ["order-lifecycle-other@example.com"]
    );
    if (other.rows.length > 0) {
      otherUserId = other.rows[0].id;
    } else {
      const created = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ["Other User", "order-lifecycle-other@example.com", "$2a$10$testhash"]
      );
      otherUserId = created.rows[0].id;
    }

    const products = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id IN (2, 3)"
    );
    originalStock = Object.fromEntries(
      products.rows.map((row) => [Number(row.id), Number(row.stock_quantity)])
    );
  });

  afterEach(async () => {
    await pool.query("DROP TRIGGER IF EXISTS test_fail_order_cancellation ON orders");
    await pool.query("DROP FUNCTION IF EXISTS test_fail_order_cancellation()");

    await pool.query(
      `DELETE FROM order_items
       WHERE order_id IN (SELECT id FROM orders WHERE user_id = ANY($1::bigint[]))`,
      [[userId, otherUserId]]
    );
    await pool.query("DELETE FROM orders WHERE user_id = ANY($1::bigint[])", [
      [userId, otherUserId],
    ]);

    for (const [id, stock] of Object.entries(originalStock)) {
      await pool.query("UPDATE products SET stock_quantity = $1 WHERE id = $2", [
        stock,
        Number(id),
      ]);
    }
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = $1", [
      "order-lifecycle-other@example.com",
    ]);
  });

  it("calculates Monday-Friday delivery windows and skips weekends", () => {
    expect(addWorkingDays(new Date("2026-01-05T00:00:00Z"), 7)).toBe("2026-01-14");
    expect(addWorkingDays(new Date("2026-01-05T00:00:00Z"), 14)).toBe("2026-01-23");
    expect(addWorkingDays(new Date("2026-01-09T00:00:00Z"), 7)).toBe("2026-01-20");
    expect(addWorkingDays(new Date("2026-01-09T00:00:00Z"), 14)).toBe("2026-01-29");
    expect(calculateDeliveryWindow(new Date("2026-12-31T00:00:00Z"))).toEqual({
      from: "2027-01-11",
      to: "2027-01-20",
    });
  });

  it("validates supported payment methods and providers", () => {
    expect(normalizePayment()).toEqual({
      method: "CASH_ON_DELIVERY",
      status: "PENDING",
      provider: null,
    });
    expect(normalizePayment({ method: "card", provider: "visa" })).toEqual({
      method: "CARD",
      status: "PENDING",
      provider: "VISA",
    });
    expect(normalizePayment({ method: "MOBILE_BANKING", provider: "BKASH" }).provider).toBe("BKASH");
    expect(() => normalizePayment({ method: "CASH_ON_DELIVERY", provider: "VISA" })).toThrow(
      "Invalid payment provider"
    );
    expect(() => normalizePayment({ method: "CRYPTO" })).toThrow("Invalid payment method");
  });

  it("persists delivery and payment metadata during order creation", async () => {
    const result = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 1 }],
      {},
      { method: "CARD", provider: "MASTERCARD" }
    );

    expect(result.order.status).toBe("confirmed");
    expect(result.order.paymentMethod).toBe("CARD");
    expect(result.order.paymentProvider).toBe("MASTERCARD");
    expect(result.order.paymentStatus).toBe("PENDING");
    expect(result.order.estimatedDeliveryFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.order.estimatedDeliveryTo > result.order.estimatedDeliveryFrom).toBe(true);
  });

  it("cancels an owned order and restores all recorded stock once", async () => {
    const beforeProduct2 = Number(originalStock[2]);
    const beforeProduct3 = Number(originalStock[3]);
    const created = await orderService.createOrder(
      userId,
      [
        { productId: 2, quantity: 1 },
        { productId: 3, quantity: 2 },
      ],
      {},
      { method: "CASH_ON_DELIVERY" }
    );

    const deducted = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id IN (2, 3) ORDER BY id"
    );
    expect(Number(deducted.rows[0].stock_quantity)).toBe(beforeProduct2 - 1);
    expect(Number(deducted.rows[1].stock_quantity)).toBe(beforeProduct3 - 2);

    const cancelled = await orderService.cancelOrder(
      created.order.id,
      userId,
      "Changed my mind"
    );

    expect(cancelled.alreadyCancelled).toBe(false);
    expect(cancelled.order.status).toBe("cancelled");
    expect(cancelled.order.cancelledAt).toBeTruthy();
    expect(cancelled.order.cancelledByUserId).toBe(userId);
    expect(cancelled.order.cancellationReason).toBe("Changed my mind");
    expect(cancelled.order.paymentStatus).toBe("CANCELLED");
    expect(cancelled.order.items).toHaveLength(2);
    expect(cancelled.order.items[0].quantity).toBe(1);
    expect(cancelled.order.items[1].quantity).toBe(2);

    const restored = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id IN (2, 3) ORDER BY id"
    );
    expect(Number(restored.rows[0].stock_quantity)).toBe(beforeProduct2);
    expect(Number(restored.rows[1].stock_quantity)).toBe(beforeProduct3);
  });

  it("does not expose another customer's order and does not restore its stock", async () => {
    const before = Number(originalStock[3]);
    const created = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 1 }],
      {}
    );

    await expect(
      orderService.cancelOrder(created.order.id, otherUserId)
    ).rejects.toMatchObject({ status: 404 });

    const after = await pool.query("SELECT stock_quantity FROM products WHERE id = 3");
    expect(Number(after.rows[0].stock_quantity)).toBe(before - 1);
  });

  it("rejects cancellation for a shipped order and invalid reasons", async () => {
    const created = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 1 }],
      {}
    );
    await pool.query("UPDATE orders SET status = 'shipped' WHERE id = $1", [
      created.order.id,
    ]);

    await expect(
      orderService.cancelOrder(created.order.id, userId, "Too late")
    ).rejects.toMatchObject({ status: 409 });

    await pool.query("UPDATE orders SET status = 'confirmed' WHERE id = $1", [
      created.order.id,
    ]);
    await expect(
      orderService.cancelOrder(created.order.id, userId, "x".repeat(501))
    ).rejects.toMatchObject({ status: 400 });
  });

  it("is idempotent for repeated and concurrent cancellation", async () => {
    const before = Number(originalStock[3]);
    const created = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 2 }],
      {}
    );

    const results = await Promise.all([
      orderService.cancelOrder(created.order.id, userId),
      orderService.cancelOrder(created.order.id, userId),
    ]);

    expect(results.some((result) => result.alreadyCancelled)).toBe(true);
    const after = await pool.query("SELECT stock_quantity FROM products WHERE id = 3");
    expect(Number(after.rows[0].stock_quantity)).toBe(before);
  });

  it("rolls back stock and metadata if order cancellation update fails", async () => {
    const before = Number(originalStock[3]);
    const created = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 2 }],
      {},
      { method: "CARD", provider: "VISA" }
    );

    await pool.query(`
      CREATE OR REPLACE FUNCTION test_fail_order_cancellation()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.status = 'cancelled' THEN
          RAISE EXCEPTION 'forced cancellation failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      CREATE TRIGGER test_fail_order_cancellation
      BEFORE UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION test_fail_order_cancellation();
    `);

    await expect(orderService.cancelOrder(created.order.id, userId)).rejects.toThrow(
      "forced cancellation failure"
    );

    const order = await pool.query(
      "SELECT status, cancelled_at, cancellation_reason FROM orders WHERE id = $1",
      [created.order.id]
    );
    const product = await pool.query("SELECT stock_quantity FROM products WHERE id = 3");
    expect(order.rows[0].status).toBe("confirmed");
    expect(order.rows[0].cancelled_at).toBeNull();
    expect(order.rows[0].cancellation_reason).toBeNull();
    expect(Number(product.rows[0].stock_quantity)).toBe(before - 2);
  });

  it("requires authentication and returns cancellation metadata through the API", async () => {
    const created = await orderService.createOrder(
      userId,
      [{ productId: 3, quantity: 1 }],
      {}
    );
    const unauthorized = await request(app).post(`/api/orders/${created.order.id}/cancel`);
    expect(unauthorized.status).toBe(401);

    const token = jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET);
    const createdViaApi = await request(app)
      .post("/api/orders")
      .set("Cookie", [`access_token=${token}`])
      .send({
        items: [{ productId: 3, quantity: 1 }],
        payment: { method: "CARD", provider: "VISA" },
      });
    expect(createdViaApi.status).toBe(201);
    expect(createdViaApi.body.data.order.paymentMethod).toBe("CARD");
    expect(createdViaApi.body.data.order.paymentProvider).toBe("VISA");
    expect(createdViaApi.body.data.order.paymentStatus).toBe("PENDING");

    const cancelled = await request(app)
      .post(`/api/orders/${created.order.id}/cancel`)
      .set("Cookie", [`access_token=${token}`])
      .send({ reason: "API cancellation" });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.success).toBe(true);
    expect(cancelled.body.data.already_cancelled).toBe(false);
    expect(cancelled.body.data.order.status).toBe("cancelled");
    expect(cancelled.body.data.order.cancelledAt).toBeTruthy();
    expect(cancelled.body.data.order.cancellationReason).toBe("API cancellation");
    expect(cancelled.body.data.order.cardNumber).toBeUndefined();
    expect(cancelled.body.data.order.cvv).toBeUndefined();

    const history = await request(app)
      .get("/api/orders")
      .set("Cookie", [`access_token=${token}`]);
    expect(history.status).toBe(200);
    expect(history.body.data.orders.some((order) => order.id === created.order.id && order.status === "cancelled")).toBe(true);

    const detail = await request(app)
      .get(`/api/orders/${created.order.id}`)
      .set("Cookie", [`access_token=${token}`]);
    expect(detail.status).toBe(200);
    expect(detail.body.data.order.cancelledAt).toBeTruthy();
    expect(detail.body.data.order.paymentStatus).toBe("CANCELLED");
  });

  it("centralizes cancellable status rules", () => {
    expect(isCancellableStatus("pending")).toBe(true);
    expect(isCancellableStatus("confirmed")).toBe(true);
    expect(isCancellableStatus("processing")).toBe(true);
    expect(isCancellableStatus("shipped")).toBe(false);
    expect(isCancellableStatus("delivered")).toBe(false);
    expect(isCancellableStatus("completed")).toBe(false);
    expect(isCancellableStatus("cancelled")).toBe(false);
  });
});
