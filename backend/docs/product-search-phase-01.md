# Phase 01 — Product Discovery Backend Design

## Current architecture

The backend is an Express application under `backend/`. `src/app.js` mounts product routes at `/api/products`; `product.routes.js` delegates to a controller, the controller delegates to `product.service.js`, and the service uses the shared `pg` pool in `src/config/database.js`. There is no ORM or existing repository interface. Responses use the existing `{ success, data }` envelope, validation errors use HTTP 400 with a safe message, and unexpected errors are centralized by `error.middleware.js`. Product fields are currently returned in snake_case, including the effective `price` field.

Product listing is active-only and currently supports `featured=true`. Product detail intentionally returns inactive products because cart, checkout, and order history can still reference them. Order item unit prices are historical snapshots and are not changed by discovery.

## Product schema and authoritative fields

`products` is a denormalized table with the following relevant columns:

- identity: `id`, `name`, `slug`, `sku`
- classification: `brand`, `category`, `subcategory`
- text: `description`, `short_description`
- pricing: `price`, `regular_price`, `offer_price`, `offer_sale`
- inventory: `stock_quantity`, `low_stock_threshold`
- merchandising: `is_active`, `is_featured`
- metadata: `created_at`, `updated_at`, and existing product attributes

`price` is already the effective selling price: sale products use `offer_price` and non-sale products use `regular_price`. Discovery filters and price sorts therefore use `price`; no pricing model or order snapshot is changed.

## Public API contract

The existing endpoint remains:

```http
GET /api/products
```

Supported query parameters are:

| Parameter | Type | Default | Behavior |
|---|---|---|---|
| `q` | string | absent | Whitespace-separated terms; every term must match at least one search field |
| `category` | string | absent | Case-insensitive exact category match |
| `brand` | string | absent | Case-insensitive exact brand match |
| `subcategory` | string | absent | Case-insensitive exact subcategory match |
| `featured` | boolean | absent | `true` or `false` only |
| `sale` | boolean | absent | `true` or `false` only |
| `min_price` | non-negative number | absent | Inclusive effective-price lower bound |
| `max_price` | non-negative number | absent | Inclusive effective-price upper bound |
| `in_stock` | boolean | absent | `true` means `stock_quantity > 0`; `false` means zero stock |
| `sort` | enum | `id_asc` | One of the explicit sort mappings below |
| `limit` | integer | 20 | Inclusive range 1–100 |
| `cursor` | opaque string | absent | Signed keyset cursor from the previous response |

`is_active` is intentionally not a public query parameter. Public discovery always applies `is_active = TRUE`; the existing detail endpoint remains able to retrieve inactive products.

Unknown query parameters are rejected rather than silently ignored. Empty, malformed, or duplicate scalar parameters are rejected. `min_price > max_price` is rejected.

## Search semantics

`q` is trimmed and split on Unicode whitespace. A product matches only when every term matches at least one of `name`, `sku`, `brand`, `category`, `subcategory`, `description`, or `short_description` using case-insensitive PostgreSQL `ILIKE '%term%'`. Terms are combined with AND and fields with OR. `%` and `_` in a term are treated as literal characters. Values are always bound parameters.

For example, `q=iphone 15` means “contains iphone in a meaningful field and contains 15 in a meaningful field”; it does not require the two terms to be adjacent or in a particular order.

## Sorting and keyset pagination

Sort names map only to fixed SQL expressions:

| `sort` | Ordering |
|---|---|
| `id_asc` (default) | `id ASC` |
| `newest` | `created_at DESC, id DESC` |
| `oldest` | `created_at ASC, id ASC` |
| `price_asc` | `price ASC, id ASC` |
| `price_desc` | `price DESC, id DESC` |
| `name_asc` | `name ASC, id ASC` |
| `name_desc` | `name DESC, id DESC` |
| `featured` | `is_featured DESC, created_at DESC, id DESC` |

Every ordering has a unique `id` tie-breaker. The query fetches `limit + 1` rows and uses a keyset condition based on the final row's ordering tuple; no offset pagination is used.

The cursor is a URL-safe base64 payload plus an HMAC-SHA256 signature. The payload contains a version, sort name, ordering values, and a SHA-256 context hash of all normalized filters (excluding `limit` and `cursor`). Reusing a cursor with changed search/filter/sort parameters fails with HTTP 400. The signature uses `CURSOR_SECRET`, falling back to `JWT_SECRET`, and a development-only fixed fallback if neither is configured.

## SQL strategy

The service builds one parameterized PostgreSQL query:

1. select active products and project listing fields;
2. apply exact filters, search terms, and inclusive price/stock predicates;
3. apply the validated keyset tuple predicate when a cursor is present;
4. apply the whitelisted ORDER BY;
5. bind `limit + 1` and map the extra row only to determine `hasNextPage`.

Rating count and average are computed as correlated scalar subqueries in the same statement, so listing does not perform one rating query per product. The handler remains SQL-free. No external search service is introduced; the current product scale uses PostgreSQL `ILIKE`.

## Index strategy

Existing `is_active` and `is_featured` indexes remain. Migration 004 adds partial indexes for the default/date ordering, effective price ordering, and name ordering, all restricted to active products. These support the three principal public discovery orderings while avoiding a separate index for every text field. Category, brand, and subcategory predicates remain composable filters; their selectivity is expected to be small for this catalog and the new indexes avoid uncontrolled index proliferation. The same indexes are reflected in `schema.sql` for fresh databases.

## Response and error contract

A successful listing returns the existing envelope with pagination metadata:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "hasNextPage": false,
    "nextCursor": null
  }
}
```

A valid query with no matches is HTTP 200. Invalid query values and malformed, tampered, or context-mismatched cursors are HTTP 400. Database errors remain HTTP 500 and are not exposed.

## Compatibility and Phase 02 handoff

Product detail, cart, checkout, orders, ratings, and historical order snapshots are unchanged. The default listing remains active-only and id-ascending, and all existing product fields remain additive-compatible. Phase 02 can build a search input and composable filter controls from the documented query contract, use `pagination.nextCursor` for the next request, and treat `data: []` as an empty state. Loading and retry behavior remain frontend responsibilities; this phase makes no frontend changes.

## Testing strategy

Tests use the existing Jest/Supertest PostgreSQL setup. Coverage includes default and bounded limits, search by each meaningful field and case insensitivity, all filters and combinations, every sort mapping, strict validation, signed/cross-context cursor rejection, duplicate prevention with tied sort values, stable multi-page traversal, empty results, and existing Product/order regression tests. SQL construction tests may also assert that dynamic values are bound rather than interpolated.
