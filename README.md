# Simple E-commerce Store

## Current Phase

Phase 05 — User Registration & JWT Authentication

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

Phase 05 implements user registration and JWT authentication:

- `POST /api/auth/register` — register a new user (bcrypt password hashing)
- `POST /api/auth/login` — login and set HttpOnly JWT cookie
- `POST /api/auth/logout` — clear the auth cookie
- `GET /api/auth/me` — protected endpoint returning the current user
- `auth.middleware.js` — verifies JWT from cookie and protects routes
- Frontend login and registration pages with client-side validation
- Navigation reflects authentication state via `/api/auth/me`

Future phases will add shopping cart, order processing, and order history.