# Simple E-commerce Store

## Current Phase

Phase 02 — PostgreSQL Schema, Tables & Seed Data

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
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   └── health.js
│   └── assets/
│       └── images/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── routes/
│   │   │   └── health.routes.js
│   │   ├── controllers/
│   │   │   └── health.controller.js
│   │   ├── services/
│   │   │   └── health.service.js
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

## Current Status

Phase 02 implements the PostgreSQL schema and seed data:

- Core tables: `users`, `products`, `orders`, `order_items`
- Primary keys, foreign keys, unique constraints, and check constraints
- 12 sample products seeded
- Existing health endpoint still works

Future phases will add product REST APIs, user authentication, shopping cart, and order processing.