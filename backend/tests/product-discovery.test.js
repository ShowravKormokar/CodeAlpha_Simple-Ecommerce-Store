const request = require("supertest");
const { app } = require("../src/app");
const { parseQuery, encodeCursor, decodeCursor } = require("../src/services/product-discovery.service");

describe("Product discovery API", () => {
  it("returns pagination metadata with the default limit", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({
      limit: 20,
      hasNextPage: false,
      nextCursor: null,
    });
  });

  it("supports a safe limit and rejects invalid limits", async () => {
    const res = await request(app).get("/api/products?limit=2");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.limit).toBe(2);

    for (const value of ["0", "-1", "abc", "101"]) {
      const invalid = await request(app).get(`/api/products?limit=${value}`);
      expect(invalid.status).toBe(400);
      expect(invalid.body.success).toBe(false);
    }
  });

  it("searches meaningful fields case-insensitively and safely", async () => {
    const res = await request(app).get("/api/products?q=WIRELESS");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((product) => {
      const searchable = [product.name, product.sku, product.brand, product.category, product.subcategory, product.description, product.short_description].join(" ").toLowerCase();
      expect(searchable).toContain("wireless");
    });

    const injection = await request(app).get("/api/products?q=%25");
    expect(injection.status).toBe(200);
  });

  it("returns an empty successful result for no matches", async () => {
    const res = await request(app).get("/api/products?q=product-that-does-not-exist");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toEqual({ limit: 20, hasNextPage: false, nextCursor: null });
  });

  it("composes category, brand, sale, price, and stock filters", async () => {
    const res = await request(app).get("/api/products?category=Electronics&brand=Samsung&sale=false&min_price=100&max_price=130&in_stock=true");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].brand).toBe("Samsung");
    expect(res.body.data[0].price).toBe(119.99);
    expect(res.body.data[0].offer_sale).toBe(false);
    expect(res.body.data[0].stock_quantity).toBeGreaterThan(0);
  });

  it("supports featured and subcategory filters", async () => {
    const featured = await request(app).get("/api/products?featured=true");
    expect(featured.status).toBe(200);
    expect(featured.body.data.every((product) => product.is_featured)).toBe(true);

    const subcategory = await request(app).get("/api/products?subcategory=Audio");
    expect(subcategory.status).toBe(200);
    expect(subcategory.body.data.every((product) => product.subcategory === "Audio")).toBe(true);
  });

  it("uses every explicit sort safely and deterministically", async () => {
    const sorts = ["id_asc", "newest", "oldest", "price_asc", "price_desc", "name_asc", "name_desc", "featured"];
    for (const sort of sorts) {
      const res = await request(app).get(`/api/products?sort=${sort}`);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((product) => Number(product.id));
      expect(new Set(ids).size).toBe(ids.length);
    }

    const invalid = await request(app).get("/api/products?sort=id%20DESC");
    expect(invalid.status).toBe(400);
  });

  it("walks cursor pages without duplicates or missing products", async () => {
    const first = await request(app).get("/api/products?limit=3&sort=id_asc");
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(3);
    expect(first.body.pagination.hasNextPage).toBe(true);

    const ids = first.body.data.map((product) => Number(product.id));
    let cursor = first.body.pagination.nextCursor;
    while (cursor) {
      const res = await request(app).get(`/api/products?limit=3&sort=id_asc&cursor=${encodeURIComponent(cursor)}`);
      expect(res.status).toBe(200);
      res.body.data.forEach((product) => ids.push(Number(product.id)));
      cursor = res.body.pagination.nextCursor;
    }

    expect(ids).toEqual([...Array(12)].map((_, index) => index + 1));
    expect(new Set(ids).size).toBe(12);
  });

  it("rejects malformed cursors and cursor reuse with another context", async () => {
    const malformed = await request(app).get("/api/products?cursor=not-a-cursor");
    expect(malformed.status).toBe(400);

    const first = await request(app).get("/api/products?category=Electronics&sort=price_asc&limit=2");
    expect(first.status).toBe(200);
    const cursor = first.body.pagination.nextCursor;
    const changed = await request(app).get(`/api/products?category=Home%20%26%20Office&sort=price_asc&limit=2&cursor=${encodeURIComponent(cursor)}`);
    expect(changed.status).toBe(400);
  });

  it("rejects malformed booleans, prices, and unknown parameters", async () => {
    const invalidQueries = [
      "featured=yes",
      "sale=1",
      "in_stock=maybe",
      "min_price=-1",
      "max_price=abc",
      "min_price=20&max_price=10",
      "unknown=value",
    ];
    for (const query of invalidQueries) {
      const res = await request(app).get(`/api/products?${query}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  it("keeps cursor signing and context validation deterministic in isolation", () => {
    const parsed = parseQuery({ sort: "id_asc", limit: 2, category: "Electronics" });
    const cursor = encodeCursor(parsed, { id: "4" });
    expect(decodeCursor(cursor, parsed)).toEqual([4]);
    expect(() => decodeCursor(cursor, parseQuery({ sort: "newest", limit: 2 }))).toThrow("Cursor does not match");
  });
});
