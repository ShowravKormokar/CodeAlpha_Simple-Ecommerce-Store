const orderService = require("../src/services/order.service");
const pool = require("../src/config/database");

describe("Order System Backward Compatibility", () => {
  let testUserId;
  let originalStock = {};

  beforeAll(async () => {
    const result = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      ["test@example.com"]
    );

    if (result.rows.length > 0) {
      testUserId = result.rows[0].id;
    } else {
      const insertResult = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        ["Test User", "test@example.com", "$2a$10$testhash"]
      );
      testUserId = insertResult.rows[0].id;
    }

    // Record original stock for restoration
    const stockResult = await pool.query(
      "SELECT id, stock_quantity FROM products WHERE id IN (2, 3)"
    );
    originalStock = {};
    stockResult.rows.forEach((row) => {
      originalStock[row.id] = Number(row.stock_quantity);
    });
  });

  afterEach(async () => {
    if (testUserId) {
      await pool.query(
        "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)",
        [testUserId]
      );
      await pool.query("DELETE FROM orders WHERE user_id = $1", [testUserId]);
    }
    // Restore stock
    for (const [id, qty] of Object.entries(originalStock)) {
      await pool.query(
        "UPDATE products SET stock_quantity = $1 WHERE id = $2",
        [qty, Number(id)]
      );
    }
  });

  describe("Order creation", () => {
    it("should create an order successfully using server-side price", async () => {
      const result = await orderService.createOrder(
        testUserId,
        [{ productId: 3, quantity: 2 }],
        {
          name: "Test User",
          email: "test@example.com",
          phone: "123-456-7890",
          addressLine1: "123 Test St",
          city: "Test City",
          state: "TS",
          postalCode: "12345",
          country: "Testland",
        }
      );

      expect(result.order).toBeDefined();
      expect(Number(result.order.totalAmount)).toBe(24.0); // 12.00 * 2
      expect(result.items.length).toBe(1);

      const item = result.items[0];
      expect(Number(item.unit_price)).toBe(12.0); // price from database, not client
      expect(Number(item.subtotal)).toBe(24.0);
      expect(Number(item.quantity)).toBe(2);
    });

    it("should reject orders with invalid product IDs", async () => {
      await expect(
        orderService.createOrder(testUserId, [{ productId: 99999, quantity: 1 }], {})
      ).rejects.toThrow("Product not found");
    });

    it("should reject orders with insufficient stock", async () => {
      await expect(
        orderService.createOrder(
          testUserId,
          [{ productId: 3, quantity: 999 }],
          {}
        )
      ).rejects.toThrow("Insufficient stock");
    });

    it("should validate cart items format", async () => {
      await expect(
        orderService.createOrder(testUserId, [], {})
      ).rejects.toThrow("Cart is empty");
    });

    it("should reject invalid product ID types", async () => {
      await expect(
        orderService.createOrder(testUserId, [{ productId: "abc", quantity: 1 }], {})
      ).rejects.toThrow("Invalid product ID");
    });

    it("should reject invalid quantities", async () => {
      await expect(
        orderService.createOrder(testUserId, [{ productId: 3, quantity: 0 }], {})
      ).rejects.toThrow("Quantity must be a positive integer");
    });

    it("should use the effective price (price field) from the database, not client-supplied price", async () => {
      const result = await orderService.createOrder(
        testUserId,
        [{ productId: 3, quantity: 3, price: 999.99 }], // client tries to set price
        {}
      );

      expect(Number(result.items[0].unit_price)).toBe(12.0); // database price, not 999.99
      expect(Number(result.order.totalAmount)).toBe(36.0); // 12.00 * 3
    });

    it("should correctly price a product on sale", async () => {
      const result = await orderService.createOrder(
        testUserId,
        [{ productId: 2, quantity: 1 }],
        {}
      );

      expect(Number(result.order.totalAmount)).toBe(69.99);
      expect(Number(result.items[0].unit_price)).toBe(69.99);
    });

    it("should decrement stock after order creation", async () => {
      const before = await pool.query(
        "SELECT stock_quantity FROM products WHERE id = 3"
      );
      const beforeStock = Number(before.rows[0].stock_quantity);

      await orderService.createOrder(
        testUserId,
        [{ productId: 3, quantity: 2 }],
        {}
      );

      const after = await pool.query(
        "SELECT stock_quantity FROM products WHERE id = 3"
      );
      const afterStock = Number(after.rows[0].stock_quantity);

      expect(afterStock).toBe(beforeStock - 2);
    });

    it("should handle multiple items in one order", async () => {
      const result = await orderService.createOrder(
        testUserId,
        [
          { productId: 3, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
        {}
      );

      expect(result.items.length).toBe(2);
      expect(Number(result.items[0].unit_price)).toBe(12.0);
      expect(Number(result.items[1].unit_price)).toBe(69.99); // sale price

      const expectedTotal = parseFloat(
        (12.0 * 2 + 69.99 * 1).toFixed(2)
      );
      expect(Number(result.order.totalAmount)).toBeCloseTo(expectedTotal, 2);
    });

    it("should merge duplicate product IDs in the same order", async () => {
      const result = await orderService.createOrder(
        testUserId,
        [
          { productId: 3, quantity: 1 },
          { productId: 3, quantity: 2 },
        ],
        {}
      );

      // Should merge into one item with quantity 3
      expect(result.items.length).toBe(1);
      expect(Number(result.items[0].quantity)).toBe(3);
    });
  });

  describe("Order history", () => {
    it("should retrieve orders by user", async () => {
      const orders = await orderService.getOrdersByUser(testUserId);
      expect(Array.isArray(orders)).toBe(true);
    });

    it("should retrieve a single order with items", async () => {
      const order = await orderService.createOrder(
        testUserId,
        [{ productId: 3, quantity: 1 }],
        {}
      );

      const retrieved = await orderService.getOrderByIdAndUser(
        order.order.id,
        testUserId
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved.id).toBe(order.order.id);
      expect(retrieved.items.length).toBe(1);
      expect(retrieved.items[0].productName).toBeDefined();
    });

    it("should return null for orders not belonging to the user", async () => {
      const result = await orderService.createOrder(testUserId, [{ productId: 3, quantity: 1 }], {});

      const retrieved = await orderService.getOrderByIdAndUser(result.order.id, 99999);
      expect(retrieved).toBeNull();
    });
  });
});
