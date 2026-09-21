# Simple E-commerce Store

## Current Phase

Phase 09 — Validation, Error Handling & Security Hardening

## Stack

Frontend:
- HTML
- CSS
- JavaScript

Backend:
- Node.js
- Express.js

Database:
- PostgreSQL

## Project Structure

```
simple-ecommerce-store/
├── frontend/
│   ├── index.html
│   ├── products.html
│   ├── product-details.html
│   ├── css/
│   │   ├── style.css
│   │   ├── products.css
│   │   └── product-details.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── products.js
│   │   └── product-details.js
│   └── assets/
│       └── images/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── routes/
│   │   │   ├── health.routes.js
│   │   │   └── product.routes.js
│   │   ├── controllers/
│   │   │   ├── health.controller.js
│   │   │   └── product.controller.js
│   │   ├── services/
│   │   │   ├── health.service.js
│   │   │   └── product.service.js
│   │   └── middleware/
│   │       └── error.middleware.js
│   ├── database/
│   │   ├── schema.sql
│   │   └── seed.sql
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   └── package.json
├── .gitignore
└── README.md
```

## Local Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend will start on `http://localhost:5000`.

### Frontend

Serve the `/frontend` folder using a local development server such as VS Code Live Server (or any static file server).

Open `http://localhost:5500` (or the port Live Server assigns).

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your local PostgreSQL configuration:

```bash
cp backend/.env.example backend/.env
```

**Do NOT commit `backend/.env`.** The `.gitignore` already excludes it.

## Database

Database:
- PostgreSQL

Database name:
- simpleEcommerce

Host / Port:
- localhost:5432

Tables:
- users
- products
- orders
- order_items

### Relationships

- One user can have many orders (`users.id` → `orders.user_id`)
- One order can contain many order items (`orders.id` → `order_items.order_id`)
- One product can appear in many order items (`products.id` → `order_items.product_id`)

### Foreign Key Behavior

Foreign keys use `ON DELETE RESTRICT` for historical relationships (`orders`, `order_items`) to prevent accidental destruction of order history when a user or product is deleted. `ON UPDATE CASCADE` keeps referenced IDs in sync if primary keys change.

### Price Snapshot

`order_items.unit_price` stores the product price at the time the order was created, so historical orders remain accurate even if product prices change later.

### Money Handling

All monetary fields (`price`, `total_amount`, `unit_price`, `subtotal`) use `NUMERIC(10,2)`. No floating-point types are used.

### Schema Setup

1. Open DBeaver.
2. Connect to local PostgreSQL.
3. Select the `simpleEcommerce` database.
4. Open `backend/database/schema.sql`.
5. Execute the schema.
6. Open `backend/database/seed.sql`.
7. Execute the seed data.
8. Verify the `products` table contains 12 sample products.

## API

### Health Check

```http
GET /api/health
```

Returns:

```json
{
  "success": true,
  "message": "API is healthy",
  "database": "connected"
}
```

### Get All Products

```http
GET /api/products
```

Returns all products from the `products` table ordered by `id ASC`.

Success response (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Wireless Mouse",
      "description": "A simple wireless mouse.",
      "price": 25.99,
      "image_url": "https://example.com/images/wireless-mouse.jpg",
      "stock_quantity": 25
    }
  ]
}
```

An empty list returns `200 OK` with `"data": []`.

### Get Product by ID

```http
GET /api/products/:id
```

Success response (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Wireless Mouse",
    "description": "A simple wireless mouse.",
    "price": 25.99,
    "image_url": "https://example.com/images/wireless-mouse.jpg",
    "stock_quantity": 25
  }
}
```

### Error Responses

Invalid product ID (`400 Bad Request`):

```json
{
  "success": false,
  "message": "Invalid product ID"
}
```

Product not found (`404 Not Found`):

```json
{
  "success": false,
  "message": "Product not found"
}
```

Unexpected server/database error (`500 Internal Server Error`):

```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Phase 04 — Product Frontend

### Products Page

`products.html` displays a responsive grid of product cards. Each card is rendered dynamically from `GET /api/products` and shows:

- Product image (with fallback for broken images)
- Product name
- Short description
- Price (formatted as `$XX.XX`)
- Stock status (`In stock: N` or `Out of stock`)
- "View Details" button linking to `product-details.html?id=<id>`

### Product Details Page

`product-details.html?id=<id>` reads the product ID from the URL query string and renders full product information from `GET /api/products/:id`. The page displays:

- Product image
- Product name
- Full description
- Price
- Stock quantity with availability status
- "Add to Cart" button (disabled — cart functionality is not yet implemented)
- "Back to Products" link

### Frontend API Integration

`frontend/js/api.js` centralizes the backend base URL and provides:

```js
getProducts()
getProductById(id)
```

These functions handle HTTP status codes and return the JSON response from the backend.

### States

- **Loading:** spinner shown while the API request is in progress
- **Error:** user-friendly message with a "Retry" button if the API request fails
- **Empty:** "No products available" shown when the API returns an empty array
- **Not found:** "Product not found" shown when a product ID returns 404
- **Invalid:** "Invalid product" shown when the URL contains no valid product ID

### API Endpoints Used

```http
GET /api/products
GET /api/products/:id
```

## Current Status

## Authentication

The application uses **JWT + HttpOnly Cookie** authentication.

### Security

- Passwords are hashed with `bcryptjs` (10 rounds). Plain-text passwords are never stored.
- The JWT secret comes from the `JWT_SECRET` environment variable.
- The JWT is stored in an `HttpOnly` cookie and is **not** accessible to frontend JavaScript.
- The JWT is **not** stored in `localStorage` or `sessionStorage`.
- The cookie uses `SameSite=Lax` and `Secure=true` in production (disabled for local HTTP development).
- CORS uses an explicit frontend origin with `credentials: true`.

### Environment Variables

```env
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=1d
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
FRONTEND_URL=http://localhost:5500
```

Do not commit the real `JWT_SECRET`.

### API Endpoints

| Method | Endpoint             | Auth Required | Purpose              |
| ------ | -------------------- | ------------: | -------------------- |
| POST   | `/api/auth/register` |            No | Register a new user  |
| POST   | `/api/auth/login`    |            No | Login user           |
| POST   | `/api/auth/logout`   |            No | Clear auth cookie    |
| GET    | `/api/auth/me`       |           Yes | Get current user     |

### Authentication Flow

1. User registers or logs in via the frontend.
2. Backend validates input, hashes/verifies the password with bcrypt, and creates a JWT.
3. The JWT is returned only as an `HttpOnly` cookie — never in the JSON body.
4. On subsequent requests, the browser automatically attaches the cookie.
5. Protected routes verify the JWT via `auth.middleware.js` and attach `req.userId`.

## Current Status

## Shopping Cart

The cart is implemented with **Vanilla JavaScript** and stored in browser `localStorage`.

### Key design decisions

- **No PostgreSQL cart table.** The cart is client-side only.
- **No cart API endpoints.** The cart never talks to the backend.
- **Only `productId` and `quantity` are persisted** — never prices.
- **Product prices always come from the backend API**, so displayed prices stay current.
- **The browser is not trusted.** Phase 07 will re-fetch products, verify current prices, and check stock before creating an order.

### Cart data format

```json
[
  { "productId": 1, "quantity": 2 },
  { "productId": 5, "quantity": 1 }
}
```

### Cart page

`/cart.html` displays cart items with quantity controls, subtotals, and a summary. The checkout button is disabled (order processing belongs to Phase 07).

### Cart modules

- `frontend/js/cart.js` — centralized cart state management
- `frontend/js/cart-page.js` — cart page rendering and interactions
- Product pages (`products.html`, `product-details.html`) include Add to Cart buttons

### Cart count

The navigation displays the total number of units (e.g. `Cart (5)`). The count updates after add, increase, decrease, remove, and clear.

## Current Status

Phase 06 implements the shopping cart:

- `localStorage`-based cart with `productId` + `quantity` only
- Add, increase, decrease, remove, clear, and count
- Same-product merges into one cart item
- Stock-aware UI (out-of-stock disabled, stock limit enforced)
- Cart page with item subtotals and summary
- Add to Cart on products and product details pages
- Navigation cart count
- Malformed localStorage handled safely
- JWT remains in HttpOnly cookie only — never in localStorage

## Order Processing

### Endpoint

```http
POST /api/orders
```

Authentication: **Required** (JWT via HttpOnly cookie).

### Request body

```json
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 5, "quantity": 1 }
  ]
}
```

Only `productId` and `quantity` are sent. The browser never sends price, subtotal, or total.

### Server-side authority

The backend re-reads every product from PostgreSQL and:

1. Validates product existence
2. Validates stock (requested quantity <= current stock)
3. Locks product rows with `FOR UPDATE`
4. Calculates `subtotal = current_price × quantity`
5. Calculates `total_amount = SUM(subtotals)`
6. Creates the order
7. Creates order items
8. Decrements stock
9. Commits the transaction

All of this runs inside **one PostgreSQL transaction**. If any step fails, everything rolls back.

### Transaction strategy

```sql
BEGIN
  → SELECT ... FROM products WHERE id = ANY($1) FOR UPDATE
  → validate existence
  → validate stock
  → calculate totals
  → INSERT INTO orders
  → INSERT INTO order_items (× N)
  → UPDATE products SET stock_quantity = stock_quantity - $1
COMMIT
```

A single pooled client is used for the entire transaction. On failure, `ROLLBACK` runs and the client is released.

### Authentication integration

`req.userId` comes from the verified JWT in `auth.middleware.js`. The client cannot supply a different `userId`.

### Frontend checkout flow

1. User clicks "Place Order" on the cart page
2. Frontend checks `/api/auth/me` — unauthenticated users are prompted to log in
3. Frontend sends only `{ items: [{ productId, quantity }] }` with `credentials: 'include'`
4. On success (201), the localStorage cart is cleared and a confirmation is shown
5. On failure (400/404/409/401/500), the cart is preserved and a useful message is shown

### Important architecture

```text
Browser Cart (productId + quantity only)
        ↓
Authenticated Order API
        ↓
PostgreSQL
        ↓
Authoritative price + stock
        ↓
Transaction
        ↓
Order + Order Items + Stock decrement
```

## Current Status

Phase 07 implements order processing:

- `POST /api/orders` protected by auth middleware
- Server-side product lookup with row locking (`FOR UPDATE`)
- Stock validation (409 on insufficient stock)
- Authoritative price calculation (browser prices/totals ignored)
- Duplicate product IDs merged before processing
- Single PostgreSQL transaction with BEGIN/COMMIT/ROLLBACK
- Stock never goes negative (concurrency-safe via row locking)
- Frontend checkout with auth check and cart clearing only on success

## Order History

### Endpoints

```http
GET /api/orders
GET /api/orders/:id
```

Both require authentication (JWT via HttpOnly cookie).

### Security

- The authenticated user ID comes **only** from the verified JWT.
- The client cannot supply a `userId` to filter orders.
- `GET /api/orders` returns only the current user's orders.
- `GET /api/orders/:id` enforces `order.id = $1 AND order.user_id = $2`.
- Cross-user access returns `404` (does not reveal another user's order exists).
- Invalid order IDs return `400`.
- SQL is parameterized.

### Historical accuracy

- `order_items.unit_price` stores the price at purchase time.
- Historical orders show the stored `unit_price`, not the current `products.price`.
- The stored `orders.total_amount` is the authoritative historical total.

### Frontend

- `frontend/orders.html` — order history list (newest first)
- `frontend/order-details.html?id=<id>` — order details with items
- Loading, empty, and error states
- Orders link appears in navigation only for authenticated users
- Unauthenticated visitors are prompted to log in

## Validation & Security

### Input validation

- Product IDs must be positive integers (`abc`, `1.5`, `0`, `-1` → 400)
- Order IDs must be positive integers
- Registration validates name, email format, password length, and confirmation
- Order items must be a non-empty array of `{ productId, quantity }` with positive integers
- Duplicate product IDs are merged before processing
- Invalid input returns `400` with a consistent error shape

### Centralized error handling

A single Express error middleware handles all errors:

- `400` → invalid input
- `401` → unauthenticated
- `404` → resource not found
- `409` → conflict (duplicate email, insufficient stock)
- `500` → unexpected server error

Stack traces and raw PostgreSQL errors are never exposed to clients. They are logged server-side only.

### SQL injection prevention

All database queries use parameterized statements (`$1`, `$2`, ...). No SQL is constructed via string interpolation. The existing PostgreSQL transaction architecture is preserved.

### Authentication & cookie security

- JWT is stored only in an `HttpOnly` cookie
- JWT is never stored in `localStorage` or `sessionStorage`
- JWT is never returned in API responses
- JWT payload is minimal (`{ sub: userId }`)
- Cookie uses `SameSite=Lax`, `Secure` toggled via `COOKIE_SECURE` env var
- Logout properly clears the auth cookie
- Invalid/expired tokens return `401`

### CORS

- Frontend origin is explicitly configured via `CORS_ORIGIN`
- `127.0.0.1` and `localhost` variants are both allowed
- `credentials: true` is enabled (required for cookies)
- Wildcard origins are not used with credentialed requests

### Security headers

`helmet` is used to set basic security headers (`x-content-type-options`, `x-frame-options`, etc.) without affecting the API contract.

### Authorization / ownership

- `GET /api/orders` returns only the current user's orders (user ID from JWT)
- `GET /api/orders/:id` enforces `order.id = $1 AND order.user_id = $2`
- Cross-user access returns a safe `404`
- The client cannot choose `userId`, `price`, `subtotal`, or `totalAmount`

### Order transaction integrity

- Stock validation occurs inside the transaction with `FOR UPDATE` row locking
- Order creation, order items, and stock updates use one transaction
- Failures trigger `ROLLBACK`
- The database client is always released
- The cart is cleared only after successful order creation on the frontend

### localStorage cart

The cart is treated as untrusted client data:

- Malformed JSON is handled safely
- Invalid product IDs and quantities are rejected
- Stored prices and totals are never trusted
- The backend re-validates product IDs, prices, and stock during order creation

### Secrets

- `.env` is ignored by Git
- `.env.example` contains placeholders only
- No secrets are hard-coded in source
- No credentials or tokens are included in frontend JavaScript

## Current Status

Phase 09 hardens the existing application:

- Centralized error middleware that never exposes stack traces
- `helmet` security headers
- Input validation on all endpoints (product IDs, order IDs, auth fields, order items)
- SQL injection prevention via parameterized queries
- Authenticated ownership enforcement on order retrieval
- Untrusted localStorage cart handling
- Secrets audit — no credentials exposed
- All Phase 01–08 functionality remains intact