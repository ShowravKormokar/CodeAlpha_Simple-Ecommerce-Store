const { validateProduct } = require("../src/services/product.service");

describe("Product Validation", () => {
  function makeValidProduct(overrides = {}) {
    return {
      name: "Test Product",
      slug: "test-product",
      price: 10.0,
      stock_quantity: 10,
      ...overrides,
    };
  }

  describe("name validation", () => {
    it("should require a non-empty name", () => {
      const result = validateProduct(makeValidProduct({ name: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("name is required and must be a non-empty string");
    });

    it("should reject non-string name", () => {
      const result = validateProduct(makeValidProduct({ name: 123 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("slug validation", () => {
    it("should require a non-empty slug", () => {
      const result = validateProduct(makeValidProduct({ slug: "" }));
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("slug is required and must be a non-empty string");
    });
  });

  describe("price validation", () => {
    it("should accept a valid price", () => {
      const result = validateProduct(makeValidProduct({ price: 9.99 }));
      expect(result.valid).toBe(true);
    });

    it("should reject negative price", () => {
      const result = validateProduct(makeValidProduct({ price: -10 }));
      expect(result.valid).toBe(false);
    });

    it("should reject non-numeric price", () => {
      const result = validateProduct(makeValidProduct({ price: "abc" }));
      expect(result.valid).toBe(false);
    });
  });

  describe("regular_price validation", () => {
    it("should accept null regular_price", () => {
      const result = validateProduct(makeValidProduct({ regular_price: null }));
      expect(result.valid).toBe(true);
    });

    it("should reject negative regular_price", () => {
      const result = validateProduct(makeValidProduct({ regular_price: -5 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("offer_price validation", () => {
    it("should accept null offer_price when offer_sale is false", () => {
      const result = validateProduct(
        makeValidProduct({ offer_sale: false, offer_price: null })
      );
      expect(result.valid).toBe(true);
    });

    it("should reject null offer_price when offer_sale is true", () => {
      const result = validateProduct(
        makeValidProduct({ offer_sale: true, offer_price: null, regular_price: 50 })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("offer_price is required when offer_sale is true");
    });

    it("should reject offer_price >= regular_price when offer_sale is true", () => {
      const result = validateProduct(
        makeValidProduct({
          offer_sale: true,
          offer_price: 50,
          regular_price: 50,
        })
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("offer_price must be less than regular_price when offer_sale is true");
    });

    it("should accept offer_price < regular_price when offer_sale is true", () => {
      const result = validateProduct(
        makeValidProduct({
          offer_sale: true,
          offer_price: 30,
          regular_price: 50,
        })
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("stock_quantity validation", () => {
    it("should accept valid stock_quantity", () => {
      const result = validateProduct(makeValidProduct({ stock_quantity: 10 }));
      expect(result.valid).toBe(true);
    });

    it("should reject negative stock_quantity", () => {
      const result = validateProduct(makeValidProduct({ stock_quantity: -1 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("low_stock_threshold validation", () => {
    it("should accept valid threshold", () => {
      const result = validateProduct(makeValidProduct({ low_stock_threshold: 5 }));
      expect(result.valid).toBe(true);
    });

    it("should reject negative threshold", () => {
      const result = validateProduct(makeValidProduct({ low_stock_threshold: -1 }));
      expect(result.valid).toBe(false);
    });
  });

  describe("colors validation", () => {
    it("should accept valid color array", () => {
      const result = validateProduct(
        makeValidProduct({ colors: ["Black", "White"] })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized.colors).toEqual(["Black", "White"]);
    });

    it("should deduplicate colors", () => {
      const result = validateProduct(
        makeValidProduct({ colors: ["Black", "White", "Black"] })
      );
      expect(result.normalized.colors).toEqual(["Black", "White"]);
    });

    it("should reject empty string in array", () => {
      const result = validateProduct(
        makeValidProduct({ colors: ["Black", "", "White"] })
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("colors");
    });

    it("should reject non-string elements", () => {
      const result = validateProduct(
        makeValidProduct({ colors: ["Black", 123] })
      );
      expect(result.valid).toBe(false);
    });

    it("should reject non-array value", () => {
      const result = validateProduct(
        makeValidProduct({ colors: "Black" })
      );
      expect(result.valid).toBe(false);
    });

    it("should trim whitespace from color values", () => {
      const result = validateProduct(
        makeValidProduct({ colors: ["  Black  ", "White"] })
      );
      expect(result.normalized.colors).toEqual(["Black", "White"]);
    });
  });

  describe("sizes validation", () => {
    it("should accept valid size array", () => {
      const result = validateProduct(
        makeValidProduct({ sizes: ["S", "M", "L", "XL"] })
      );
      expect(result.valid).toBe(true);
    });

    it("should accept empty array", () => {
      const result = validateProduct(
        makeValidProduct({ sizes: [] })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized.sizes).toEqual([]);
    });
  });

  describe("specifications validation", () => {
    it("should accept a valid specifications object", () => {
      const result = validateProduct(
        makeValidProduct({
          specifications: { Material: "Cotton", Weight: "500g" },
        })
      );
      expect(result.valid).toBe(true);
    });

    it("should accept null specifications (default to empty object)", () => {
      const result = validateProduct(
        makeValidProduct({ specifications: null })
      );
      expect(result.valid).toBe(true);
      expect(result.normalized.specifications).toEqual({});
    });

    it("should reject array as specifications", () => {
      const result = validateProduct(
        makeValidProduct({ specifications: ["a", "b"] })
      );
      expect(result.valid).toBe(false);
    });

    it("should reject string as specifications", () => {
      const result = validateProduct(
        makeValidProduct({ specifications: "specs" })
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("boolean validation", () => {
    it("should accept boolean is_active", () => {
      const result = validateProduct(makeValidProduct({ is_active: true }));
      expect(result.valid).toBe(true);
    });

    it("should accept string is_active", () => {
      const result = validateProduct(makeValidProduct({ is_active: "true" }));
      expect(result.valid).toBe(true);
    });

    it("should reject non-boolean is_active", () => {
      const result = validateProduct(makeValidProduct({ is_active: "notabool" }));
      expect(result.valid).toBe(false);
    });
  });

  describe("tags validation", () => {
    it("should deduplicate and trim tags", () => {
      const result = validateProduct(
        makeValidProduct({ tags: ["  sale  ", "new", "sale"] })
      );
      expect(result.normalized.tags).toEqual(["sale", "new"]);
    });
  });

  describe("normalized output", () => {
    it("should normalize money values to numbers", () => {
      const result = validateProduct(
        makeValidProduct({ price: "10.50", regular_price: "10.50" })
      );
      expect(result.normalized.price).toBe(10.5);
      expect(result.normalized.regular_price).toBe(10.5);
    });

    it("should default offer_sale to false", () => {
      const result = validateProduct(makeValidProduct({ offer_sale: undefined }));
      expect(result.normalized.offer_sale).toBe(false);
    });

    it("should default low_stock_threshold to 5", () => {
      const result = validateProduct(makeValidProduct({}));
      expect(result.normalized.low_stock_threshold).toBe(5);
    });

    it("should normalize empty/undefined optional arrays to []", () => {
      const result = validateProduct(makeValidProduct({ colors: undefined }));
      expect(result.normalized.colors).toEqual([]);
      expect(result.normalized.sizes).toEqual([]);
      expect(result.normalized.tags).toEqual([]);
    });
  });
});
