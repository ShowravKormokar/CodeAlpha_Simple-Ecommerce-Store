# Phase 01 — Product Data Expansion: Backend Design Document

## 1. Current Product Schema

```sql
CREATE TABLE products (
    id             BIGSERIAL      PRIMARY KEY,
    name           VARCHAR(255)   NOT NULL,
    description    TEXT,
    price          NUMERIC(10,2)  NOT NULL CHECK (price >= 0),
    image_url      TEXT,
    stock_quantity INTEGER        NOT NULL CHECK (stock_quantity >= 0),
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### How `price` is currently used

| Location | Usage |
|---|---|
| `product.service.js` | Selects `price` column, returns as raw DB row |
| `order.service.js` line 7,162 | `findProductsByIds` reads `price`; `unitPrice = Number(product.price)` for order items |
| `cart-page.js` / `checkout.js` (frontend) | `product.price` for display and client-side subtotal |

### How `stock_quantity` is currently used

| Location | Usage |
|---|---|
| `product.service.js` | Selects `stock_quantity`, returns as raw DB row |
| `order.service.js` line 146-153 | Reads `product.stock_quantity` for stock validation during checkout |
| `cart-page.js` / `checkout.js` (frontend) | `product.stock_quantity` for quantity limits |

### How `id`, `name`, `description`, `image_url` are used

- `product.service.js`: selects all columns, returns raw rows
- `order.service.js` `getOrderByIdAndUser`: joins `products p ON p.id = oi.product_id`, selects `p.name AS product_name`
- Frontend: uses `product.id`, `product.name`, `product.description`, `product.image_url`, `product.stock_quantity`, `product.price`

### API response format (current)

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Wireless Mouse", "description": "...", "price": "25.99", ... }
  ]
}
```

- Listing: `GET /api/products` → `{ success: true, data: [product, ...] }`
- Detail: `GET /api/products/:id` → `{ success: true, data: product }`

Products are returned in **snake_case** (raw DB rows + `rating` object).

---

## 2. Proposed Product Schema

### Identity (existing + new)

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| id | BIGSERIAL PK | NOT NULL | auto | Existing — preserved |
| name | VARCHAR(255) | NOT NULL | — | Existing — preserved |
| slug | VARCHAR(255) | NOT NULL | — | URL-friendly identifier |
| sku | VARCHAR(100) | nullable | NULL | Stock keeping unit (unique when present) |

### Classification

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| brand | VARCHAR(255) | YES | NULL | Manufacturer/brand name |
| category | VARCHAR(255) | YES | NULL | Main category (e.g. Electronics) |
| subcategory | VARCHAR(255) | YES | NULL | Sub-category (e.g. Headphones) |

### Description

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| description | TEXT | YES | NULL | Existing — preserved (long) |
| short_description | TEXT | YES | NULL | Short summary for listings |

### Pricing

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| price | NUMERIC(10,2) | NOT NULL | — | **Effective selling price** (backward-compatible) |
| regular_price | NUMERIC(10,2) | YES | NULL | Base/normal price |
| offer_price | NUMERIC(10,2) | YES | NULL | Discounted price when on sale |
| offer_sale | BOOLEAN | NOT NULL | FALSE | Whether a sale is active |

**Pricing model:**

- `price` = effective selling price (what the customer pays). This is the value
  used by the order system (`unitPrice`).
- `regular_price` = the normal/base price (the "was" price).
- `offer_price` = the discounted price (NULL when no offer).
- `offer_sale` = boolean flag for whether an offer is active.
- Business rule: when `offer_sale = true`, `price = offer_price` and
  `offer_price < regular_price`. When `offer_sale = false`, `price = regular_price`
  and `offer_price = NULL`.

### Inventory

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| stock_quantity | INTEGER | NOT NULL | — | Existing — preserved |
| low_stock_threshold | INTEGER | NOT NULL | 5 | Threshold for "low stock" UI |

### Store merchandising

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| is_active | BOOLEAN | NOT NULL | TRUE | Excluded from public listing when false |
| is_featured | BOOLEAN | NOT NULL | FALSE | Featured products flag |

### Product media

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| image_url | TEXT | YES | NULL | Existing — preserved |

### Product attributes

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| colors | TEXT[] | NOT NULL | `'{}'` | Available colors (empty array = no colors) |
| sizes | TEXT[] | NOT NULL | `'{}'` | Available sizes (empty array = no sizes) |
| variant | TEXT | YES | NULL | Product variant label (e.g. "Over-Ear") |
| specifications | JSONB | NOT NULL | `'{}'` | Flexible key/value specs (empty object = no specs) |

### Manufacturing / origin

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| vendor | TEXT | YES | NULL | Supplier/vendor name |
| made_in | TEXT | YES | NULL | Country of manufacture |

### Optional additional metadata

| Field | Type | Nullable | Default | Rationale |
|---|---|---|---|---|
| barcode | VARCHAR(100) | YES | NULL | Optional barcode (EAN/UPC) |
| weight | NUMERIC(10,3) | YES | NULL | Weight in kg (3 decimal places) |
| unit | VARCHAR(50) | YES | NULL | Unit of sale (e.g. "piece") |
| material | TEXT | YES | NULL | Material description |
| warranty | TEXT | YES | NULL | Warranty text |
| tags | TEXT[] | NOT NULL | `'{}'` | Searchable tags (empty array = no tags) |

### Timestamps (existing)

| Field | Type | Nullable | Default |
|---|---|---|---|
| created_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | NOT NULL | CURRENT_TIMESTAMP |

---

## 3. PostgreSQL Data Types — Rationale

- **NUMERIC(10,2)**: matches existing `price` column. All money fields use this.
- **TEXT[]**: chosen for `colors`, `sizes`, `tags`. PostgreSQL native arrays are simple
  and work with the existing `pg` driver. No foreign keys needed for a simple assignment.
- **JSONB**: chosen for `specifications`. Products have heterogeneous spec keys;
  JSONB allows flexible key/value storage without a separate table.
- **BOOLEAN**: for `is_active`, `is_featured`, `offer_sale`.
- **INTEGER**: for `stock_quantity`, `low_stock_threshold` (reuses existing convention).
- **VARCHAR**: variable-length strings for text fields (matching `users` table style).
- **TIMESTAMPTZ**: matches existing timestamp convention.

---

## 4. Nullable / Default Decisions

| Field | Nullable | Default |
|---|---|---|
| slug | NOT NULL | — (backfilled from name) |
| sku | YES | NULL (backfilled for existing products) |
| brand | YES | NULL |
| category | YES | NULL |
| subcategory | YES | NULL |
| short_description | YES | NULL |
| regular_price | YES | NULL (backfilled from price) |
| offer_price | YES | NULL |
| offer_sale | NOT NULL | FALSE |
| low_stock_threshold | NOT NULL | 5 |
| is_active | NOT NULL | TRUE |
| is_featured | NOT NULL | FALSE |
| colors | NOT NULL | `'{}'` |
| sizes | NOT NULL | `'{}'` |
| variant | YES | NULL |
| specifications | NOT NULL | `'{}'` |
| vendor | YES | NULL |
| made_in | YES | NULL |
| barcode | YES | NULL |
| weight | YES | NULL |
| unit | YES | NULL |
| material | YES | NULL |
| warranty | YES | NULL |
| tags | NOT NULL | `'{}'` |

---

## 5. Optional Field Conventions

The API represents optional values consistently:

| Field type | Representation | Example |
|---|---|---|
| Optional scalar | `null` | `"brand": null` |
| Optional array | `[]` (empty array) | `"colors": []` |
| Optional object | `{}` (empty object) | `"specifications": {}` |
| Optional money | `null` | `"offer_price": null` |

Arrays and objects are **never** returned as `null` — they are always `[]` or `{}`.
This gives the frontend a consistent contract: always check `length` for arrays,
always iterate for objects.

---

## 6. Pricing Behavior

### No offer

```json
{
  "regular_price": 25.99,
  "offer_price": null,
  "offer_sale": false,
  "price": 25.99
}
```

### Active offer

```json
{
  "regular_price": 79.50,
  "offer_price": 69.99,
  "offer_sale": true,
  "price": 69.99
}
```

`price` is the effective selling price. The order system uses `price` as
`unitPrice`, so it always charges the correct amount regardless of offers.

The backend is the **source of truth** for order pricing. The frontend never
sends a price in the checkout request — it only sends `productId` and `quantity`.

---

## 7. `is_active` Behavior

- `GET /api/products` (listing): only returns `is_active = true` products.
- `GET /api/products/:id` (detail): returns the product regardless of
  `is_active`. This preserves cart/checkout/order-history functionality
  (a product deactivated after being added to cart should still be visible
  at its detail page with an "out of stock" or "currently unavailable" state).
- `?featured=true` query parameter: filters to `is_active = true AND is_featured = true`.

All existing seed products will have `is_active = true`, so there is no
behavior change for current data.

---

## 8. `is_featured` Behavior

- The normal listing (`GET /api/products`) returns all active products
  and includes the `is_featured` field in each product.
- `GET /api/products?featured=true` returns only active + featured products.
- No separate endpoint is created; this is a lightweight query parameter.

---

## 9. Seed Migration Strategy

### Existing seed data (12 products)

| # | Name | Price | Stock |
|---|---|---|---|
| 1 | Wireless Mouse | 25.99 | 25 |
| 2 | Mechanical Keyboard | 79.50 | 18 |
| 3 | USB-C Charging Cable | 12.00 | 100 |
| 4 | Laptop Stand | 34.99 | 15 |
| 5 | Bluetooth Speaker | 49.99 | 30 |
| 6 | USB Flash Drive 128GB | 19.75 | 60 |
| 7 | Wireless Earbuds | 89.00 | 22 |
| 8 | External SSD 1TB | 119.99 | 12 |
| 9 | Monitor 27" 144Hz | 299.00 | 8 |
| 10 | Webcam 1080p | 45.50 | 20 |
| 11 | Desk Lamp LED | 28.99 | 14 |
| 12 | Noise-Cancelling Headphones | 159.00 | 9 |

### Enrichment plan

- All 12 products keep their existing IDs, names, descriptions, and image URLs.
- Each product receives a unique SKU (e.g. `SKU-WM-001`).
- 4 products receive offers:
  - Mechanical Keyboard: regular 79.50 → offer 69.99
  - Bluetooth Speaker: regular 49.99 → offer 42.99
  - Monitor 27" 144Hz: regular 299.00 → offer 279.00
  - Noise-Cancelling Headphones: regular 159.00 → offer 129.00
- 8 products have no offer (`offer_sale = false`, `offer_price = null`).
- Featured products: Wireless Mouse, Bluetooth Speaker, Wireless Earbuds,
  Monitor 27" 144Hz, Noise-Cancelling Headphones.

### Idempotency

- The seed uses `INSERT ... ON CONFLICT (sku) DO UPDATE SET` so running
  `npm run seed` multiple times does not create duplicates.
- The migration backfills SKUs for existing rows (matched by name) so that
  `ON CONFLICT (sku)` can match them.
- Stock values in the seed match the original seed, so re-seeding is a no-op
  for stock (unless intentionally changed in the seed data).

---

## 10. API Response Contract (Final)

### Product listing — `GET /api/products`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Wireless Mouse",
      "slug": "wireless-mouse",
      "sku": "SKU-WM-001",
      "description": "...",
      "short_description": "...",
      "price": "25.99",
      "regular_price": "25.99",
      "offer_price": null,
      "offer_sale": false,
      "image_url": "https://example.com/images/wireless-mouse.jpg",
      "stock_quantity": 25,
      "low_stock_threshold": 5,
      "is_active": true,
      "is_featured": true,
      "colors": ["Black", "White"],
      "sizes": [],
      "variant": null,
      "specifications": { "Connectivity": "2.4GHz Wireless" },
      "vendor": "Logitech",
      "made_in": "China",
      "barcode": null,
      "weight": null,
      "unit": "piece",
      "material": null,
      "warranty": null,
      "tags": ["accessories", "wireless", "mouse"],
      "category": "Electronics",
      "subcategory": "Computer Accessories",
      "brand": "Logitech",
      "created_at": "2026-...",
      "updated_at": "2026-...",
      "rating": { "average": 0, "count": 0 }
    }
  ]
}
```

### Field name convention

The API uses **snake_case** throughout, matching the existing DB column names.
This is consistent with how the current product service returns raw rows.
Order endpoints use camelCase, but product endpoints have always used snake_case.

---

## 11. Backward Compatibility

| Concern | Resolution |
|---|---|
| `price` field must remain | `price` is kept as effective selling price. Order system unchanged. |
| Existing IDs preserved | Migration is additive; seed uses `ON CONFLICT (sku)` on existing rows. |
| Existing names/descriptions/images preserved | Seed data keeps the same core values. |
| Existing stock preserved | Seed sets the same stock values; migration does not touch stock. |
| Order creation unaffected | `order.service.js` still reads `price`, `stock_quantity` — unchanged. |
| Order history unaffected | `getOrderByIdAndUser` joins products for `name` — unchanged. |
| Frontend unaffected | All existing fields remain; new fields are additive. `price` stays effective price. |
| `getProductById` works for inactive | Product detail returns regardless of `is_active`. |
| Product listing shows active only | Only affects inactive products (none in seed). |

---

## 12. Validation Rules

### Product price fields

| Rule | When |
|---|---|
| `price` must be >= 0 | Always (existing CHECK constraint) |
| `regular_price` must be >= 0 | When provided |
| `offer_price` must be >= 0 | When provided |
| `offer_price < regular_price` | When `offer_sale = true` |
| `offer_price` should be NULL | When `offer_sale = false` |
| `price` = `offer_price` | When `offer_sale = true` |
| `price` = `regular_price` | When `offer_sale = false` |

### Product quantity fields

| Rule | When |
|---|---|
| `stock_quantity` must be >= 0 | Always (existing CHECK constraint) |
| `low_stock_threshold` must be >= 0 | Always |

### Product attribute fields

| Rule |
|---|
| `colors`, `sizes`, `tags`: each element must be a non-empty string after trimming |
| `colors`, `sizes`, `tags`: duplicates are normalized (deduplicated) |
| `specifications`: must be a JSON object (not array, not scalar) |
| `name`: must be a non-empty string (existing NOT NULL) |
| `sku`: if provided, must be a non-empty string |
| `slug`: must be a non-empty string |

### Booleans

| Field | Rule |
|---|---|
| `is_active`, `is_featured`, `offer_sale` | Must be boolean (or coercible) |

---

## 13. Test Plan

### Product retrieval

1. **Listing returns new fields**: `GET /api/products` response includes all new fields.
2. **Detail returns new fields**: `GET /api/products/1` returns all new fields.
3. **Optional fields returned correctly**: fields with no data are `null`, `[]`, or `{}`.
4. **Arrays returned correctly**: `colors`, `sizes`, `tags` are JavaScript arrays.
5. **Specifications returned correctly**: `specifications` is a JSON object.

### Optional values

6. **Empty arrays**: A product with no colors/sizes returns `colors: []`, `sizes: []`.
7. **Empty objects**: A product with no specs returns `specifications: {}`.
8. **Null scalars**: A product with no brand/vendor/variant returns `null`.

### Offer pricing

9. **No offer**: `offer_sale = false`, `offer_price = null`, `price = regular_price`.
10. **Active offer**: `offer_sale = true`, `offer_price` set, `price = offer_price`,
    `offer_price < regular_price`.
11. **Listing price reflects offer**: the `price` field shows the discounted amount.

### Active/inactive

12. **Inactive excluded from listing**: setting `is_active = false` removes product from `GET /api/products`.
13. **Inactive available by ID**: `GET /api/products/:id` still returns inactive product.

### Featured

14. **`?featured=true`**: returns only `is_featured = true` active products.

### Existing functionality (backward compatibility)

15. **Product listing works**: all 12 products returned (all active).
16. **Product detail works**: individual product accessible by ID.
17. **Order creation works**: cart → checkout → order, backend price is authoritative.
18. **Stock decrement works**: order creation reduces stock.
19. **Order history works**: `GET /api/orders` and `GET /api/orders/:id`.

### Seed idempotency

20. **No duplicates**: running seed twice produces same row count.
21. **Existing data preserved**: IDs, names, prices unchanged after re-seed.

### Validation

22. **Invalid colors rejected**: `["", " ", null, 123]` → error or normalized.
23. **Invalid specifications rejected**: non-object → error.
24. **Offer/sale consistency**: `offer_sale = true` with `offer_price >= regular_price` → error.

---

## 14. Risks / Decisions

1. **No new ORM**: Continuing with raw `pg` + raw SQL, as required.
2. **No new product CRUD endpoints**: The task does not require them, and the
   frontend does not need them in Phase 01. Validation functions are provided
   as exported utilities for testing and future use.
3. **No CHECK constraint on pricing**: Database-level constraints could break
   migration of existing data. Pricing consistency is enforced at the
   application layer.
4. **PostgreSQL arrays vs. separate tables**: Arrays chosen for simplicity
   (matches the "simple assignment" requirement). No separate
   `product_colors` table.
5. **JSONB for specifications**: Chosen because products have heterogeneous
   spec keys. No fixed schema enforced.
6. **`variant` as TEXT**: Stored as a simple string label
   (e.g. "Over-Ear", "16GB / 512GB"). No separate variant entity.
7. **Migration idempotency**: Uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`
   per the existing migration convention. Constraint creation uses `DO $$`
   blocks (see risk 10).
8. **Seed idempotency**: Uses `INSERT ... ON CONFLICT (sku) DO UPDATE SET`.
   Unique constraint on `sku` allows multiple NULLs (PostgreSQL behavior).
9. **Server refactoring**: `src/server.js` was split into `src/app.js` (exports
   Express `app`) and `src/server.js` (imports app, starts server). This
   enables testing with Supertest without binding a port.
10. **Migration constraint creation**: `ADD CONSTRAINT IF NOT EXISTS` is not
    supported in this PostgreSQL 18.1 installation. Used `DO $$ ... $$;` blocks
    that check `pg_constraint` before adding constraints. The migration is
    fully idempotent and safe to re-run.
11. **API response normalization**: The product service maps raw DB rows to a
    clean API response. NUMERIC values from PostgreSQL (returned as strings by
    the `pg` driver) are converted to JavaScript numbers. TEXT[] arrays are
    ensured to always be arrays (never null). JSONB specifications are ensured
    to always be objects (never null). This provides the consistent optional
    field contract described in section 5.
12. **Test framework**: Jest + Supertest installed for testing. Tests use the
    existing database on localhost. Setup and teardown manage test data
    (users, orders) to avoid side effects. 77 tests, 4 suites, all passing.

---

## 15. Implementation Order

1. Create this design document.
2. Create migration `003_expand_products.sql`.
3. Update `schema.sql` with new columns.
4. Rewrite `seed.sql` with enriched, idempotent data.
5. Create `scripts/seed.js` + update `package.json`.
6. Update `product.service.js` (columns, pricing, is_active filter, validation).
7. Update `product.controller.js` (featured query support).
8. Write tests.
9. Run migrations, seed, and tests.
10. Final verification.
