const request = require("supertest");
const { app } = require("../src/app");

describe("Product API", () => {
  describe("GET /api/products", () => {
    it("should return all active products with success flag", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should return 12 products after seeding", async () => {
      const res = await request(app).get("/api/products");
      expect(res.body.data.length).toBe(12);
    });

    it("should include all new fields in product response", async () => {
      const res = await request(app).get("/api/products");

      const product = res.body.data[0];

      const expectedFields = [
        "id", "name", "slug", "sku", "brand", "category", "subcategory",
        "description", "short_description", "price", "regular_price",
        "offer_price", "offer_sale", "image_url", "stock_quantity",
        "low_stock_threshold", "is_active", "is_featured", "colors", "sizes",
        "variant", "specifications", "vendor", "made_in", "barcode",
        "weight", "unit", "material", "warranty", "tags", "created_at",
        "updated_at",
      ];

      expectedFields.forEach((field) => {
        expect(product).toHaveProperty(field);
      });
    });

    it("should preserve existing product IDs, names, and descriptions", async () => {
      const res = await request(app).get("/api/products");

      const mouse = res.body.data.find((p) => p.name === "Wireless Mouse");
      expect(mouse).toBeDefined();
      expect(mouse.id).toBe(1);
      expect(mouse.description).toBe("A simple wireless mouse for everyday use.");
      expect(mouse.image_url).toBe("https://example.com/images/wireless-mouse.jpg");
      expect(mouse.stock_quantity).toBe(25);
    });

    it("should exclude inactive products from listing", async () => {
      const pool = require("../src/config/database");

      const res = await request(app).get("/api/products");
      const mouse = res.body.data.find((p) => p.name === "Wireless Mouse");
      expect(mouse).toBeDefined();

      await pool.query("UPDATE products SET is_active = FALSE WHERE id = 1");

      try {
        const res2 = await request(app).get("/api/products");
        const inactive = res2.body.data.find((p) => p.id === 1);
        expect(inactive).toBeUndefined();

        const res3 = await request(app).get("/api/products/1");
        expect(res3.status).toBe(200);
        expect(res3.body.data.id).toBe(1);
        expect(res3.body.data.is_active).toBe(false);
      } finally {
        await pool.query("UPDATE products SET is_active = TRUE WHERE id = 1");
      }
    });

    it("should support ?featured=true filter", async () => {
      const res = await request(app).get("/api/products?featured=true");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      res.body.data.forEach((product) => {
        expect(product.is_featured).toBe(true);
      });
    });

    it("should return products sorted by id ascending", async () => {
      const res = await request(app).get("/api/products");

      const ids = res.body.data.map((p) => p.id);
      const sorted = [...ids].sort((a, b) => a - b);
      expect(ids).toEqual(sorted);
    });
  });

  describe("GET /api/products/:id", () => {
    it("should return a product with all new fields", async () => {
      const res = await request(app).get("/api/products/1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const product = res.body.data;
      const expectedFields = [
        "slug", "sku", "brand", "category", "subcategory", "short_description",
        "regular_price", "offer_price", "offer_sale", "low_stock_threshold",
        "is_active", "is_featured", "colors", "sizes", "variant",
        "specifications", "vendor", "made_in", "barcode", "weight",
        "unit", "material", "warranty", "tags",
      ];
      expectedFields.forEach((field) => {
        expect(product).toHaveProperty(field);
      });
    });

    it("should return 400 for invalid product ID", async () => {
      const res = await request(app).get("/api/products/abc");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 for non-positive product ID", async () => {
      const res = await request(app).get("/api/products/0");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 for non-existent product ID", async () => {
      const res = await request(app).get("/api/products/99999");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Product not found");
    });

    it("should still return a product even if inactive", async () => {
      const pool = require("../src/config/database");

      await pool.query("UPDATE products SET is_active = FALSE WHERE id = 1");

      try {
        const res = await request(app).get("/api/products/1");
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(1);
        expect(res.body.data.is_active).toBe(false);
      } finally {
        await pool.query("UPDATE products SET is_active = TRUE WHERE id = 1");
      }
    });
  });

  describe("Optional field representation", () => {
    it("should return arrays as arrays (never null)", async () => {
      const res = await request(app).get("/api/products/1");
      expect(Array.isArray(res.body.data.colors)).toBe(true);
      expect(Array.isArray(res.body.data.sizes)).toBe(true);
      expect(Array.isArray(res.body.data.tags)).toBe(true);
    });

    it("should return specifications as an object (never null)", async () => {
      const res = await request(app).get("/api/products/1");
      expect(res.body.data.specifications).not.toBeNull();
      expect(typeof res.body.data.specifications).toBe("object");
    });

    it("should return null for offer_price when product is not on sale", async () => {
      const res = await request(app).get("/api/products");
      const mouse = res.body.data.find((p) => p.name === "Wireless Mouse");

      expect(mouse.offer_sale).toBe(false);
      expect(mouse.offer_price).toBeNull();
    });

    it("should return empty arrays for products with no colors/sizes", async () => {
      const res = await request(app).get("/api/products");
      const cable = res.body.data.find((p) => p.name === "USB-C Charging Cable");

      expect(Array.isArray(cable.colors)).toBe(true);
      expect(Array.isArray(cable.sizes)).toBe(true);
    });
  });

  describe("Offer pricing", () => {
    it("should have price = regular_price for non-sale products", async () => {
      const res = await request(app).get("/api/products");
      const mouse = res.body.data.find((p) => p.name === "Wireless Mouse");

      expect(mouse.offer_sale).toBe(false);
      expect(mouse.regular_price).toBe(25.99);
      expect(mouse.price).toBe(25.99);
      expect(mouse.offer_price).toBeNull();
    });

    it("should have price = offer_price for sale products", async () => {
      const res = await request(app).get("/api/products");
      const keyboard = res.body.data.find((p) => p.name === "Mechanical Keyboard");

      expect(keyboard.offer_sale).toBe(true);
      expect(keyboard.regular_price).toBe(79.5);
      expect(keyboard.offer_price).toBe(69.99);
      expect(keyboard.price).toBe(69.99);
      expect(keyboard.offer_price).toBeLessThan(keyboard.regular_price);
    });

    it("should have at least 2 products on sale and 2 not on sale", async () => {
      const res = await request(app).get("/api/products");
      const onSale = res.body.data.filter((p) => p.offer_sale);
      const notOnSale = res.body.data.filter((p) => !p.offer_sale);

      expect(onSale.length).toBeGreaterThanOrEqual(2);
      expect(notOnSale.length).toBeGreaterThanOrEqual(2);
    });
  });
});
