# Simple E-commerce Store

A full-stack e-commerce application built as **CodeAlpha Full Stack Software Development Internship — Task 1: Simple E-commerce Store**.

The original task was intentionally simple:

> Build a basic e-commerce site with product listings, a shopping cart, product details, order processing, and user registration/login.

This implementation goes beyond the minimum assignment requirements by applying **production-oriented software engineering practices** around authentication, authorization, transactional order processing, inventory consistency, product discovery, payment-flow design, order lifecycle management, validation, security, testing, Dockerized development, database migrations, seed management, and technical documentation.

The goal is not only to demonstrate that the application works, but to demonstrate **how a maintainable, secure, testable, and scalable full-stack system can be designed and evolved**.
---  
<img width="1672" height="941" alt="codealpha_internship" src="https://github.com/user-attachments/assets/22ae8683-bae6-48bd-97a3-cbb3b3fe7ab3" />

---

## 1. Project Overview

### Assignment

**CodeAlpha — Full Stack Software Development Internship**
**Task 1 — Simple E-commerce Store**

### Original Requirements

* Product listing
* Product details
* Shopping cart
* Order processing
* User registration/login
* Database-backed products, users, and orders

### Implementation

The project is implemented as a full-stack web application using:

* **Frontend:** HTML, CSS, Vanilla JavaScript
* **Backend:** Node.js + Express.js
* **Database:** PostgreSQL
* **Authentication:** JWT + HttpOnly cookies
* **Testing:** Jest
* **Reverse Proxy / Static Serving:** Nginx
* **Containerization:** Docker + Docker Compose

The application deliberately avoids frontend frameworks and unnecessary dependencies so that the underlying **HTTP, authentication, state-management, database, transaction, and architecture decisions remain explicit and easy to inspect**.

---

# 2. What This Project Demonstrates

Although the project started as a small internship assignment, the implementation focuses on real engineering concerns that appear in production systems.

### Core application engineering

* Full-stack client/server architecture
* REST-style API design
* Modular Express backend
* Separation of routes, controllers, services, and middleware
* Centralized API communication on the frontend
* PostgreSQL relational data modeling
* Database migrations and seed management
* Environment-based configuration

### Security engineering

* JWT-based authentication
* HttpOnly authentication cookies
* Password hashing with bcrypt
* Explicit CORS configuration
* Helmet security headers
* Input validation
* Parameterized SQL queries
* Authorization and resource ownership checks
* No sensitive payment credentials stored
* Secrets kept outside source code

### Data integrity

* PostgreSQL transactions
* Row-level locking with `FOR UPDATE`
* Server-authoritative prices
* Server-authoritative stock
* Atomic order creation
* Atomic order cancellation and stock restoration
* Historical price snapshots
* Idempotent cancellation behavior
* Database constraints and foreign keys

### Product discovery

* Server-side search
* Multiple composable filters
* Server-side sorting
* Cursor-based pagination
* Query-context-bound cursors
* Deterministic pagination ordering

### Application lifecycle

* Authentication
* Product discovery
* Cart management
* Checkout
* Dummy payment experience
* Order creation
* Order tracking
* Order cancellation
* Inventory restoration
* Order history
* Order details
* Product ratings

### Engineering operations

* Dockerized development
* Docker Compose orchestration
* Nginx reverse proxy
* PostgreSQL persistent volume
* Database initialization
* Migrations
* Seed scripts
* Environment configuration
* Automated testing
* API documentation
* Architecture documentation
* Phase-specific implementation documentation

---

# 3. Feature Overview

## Authentication & Account Management

The application provides a secure authentication flow using JWT authentication stored in an HttpOnly cookie.

### Features

* User registration
* User login
* User logout
* Current-user/session retrieval
* Password hashing
* Protected API routes
* Authentication-aware navigation
* Account information
* Authenticated order history

### Authentication architecture

```text
Browser
   │
   │ Login / Register
   ▼
Express API
   │
   ├── Validate input
   ├── Hash / verify password
   └── Issue JWT
          │
          ▼
    HttpOnly Cookie
          │
          ▼
Browser automatically sends cookie
          │
          ▼
Authentication Middleware
          │
          └── req.userId
```

The JWT is never stored in `localStorage` or `sessionStorage` and is never returned as a normal API response value.

### Security properties

* `HttpOnly` cookie
* `SameSite` protection
* `Secure` cookie in production
* Explicit CORS origin
* Credentialed requests
* Minimal JWT payload
* Password hashing with bcrypt
* Environment-based JWT secret
* Proper logout cookie clearing

---

# 4. Product Catalog

The product system supports both basic catalog browsing and more advanced product discovery.

### Product capabilities

* Product listing
* Product details
* Product images
* Product descriptions
* Product pricing
* Stock quantity
* Categories
* Brands
* Subcategories
* Featured products
* Sale products
* Product metadata/specifications
* Product availability states

The frontend dynamically consumes the product API instead of maintaining a duplicated product dataset.

---

# 5. Product Search, Filtering & Sorting

Product discovery is implemented as a **database-backed query pipeline**, rather than downloading the entire catalog and filtering it in JavaScript.

### Search

Search supports case-insensitive matching across meaningful product fields such as:

* Name
* SKU
* Brand
* Category
* Subcategory
* Description
* Short description

### Filters

Supported filters include:

* Category
* Brand
* Subcategory
* Featured
* Sale
* Minimum price
* Maximum price
* Stock availability

### Sorting

Supported server-side sorting includes:

* ID ascending
* Newest
* Oldest
* Price ascending
* Price descending
* Name ascending
* Name descending
* Featured

### Cursor pagination

The product API uses **cursor/keyset pagination** rather than traditional offset pagination.

```text
Client
  │
  │ q + filters + sort + limit
  ▼
Product API
  │
  ▼
PostgreSQL
  │
  │ keyset/cursor query
  ▼
Products + nextCursor
  │
  ▼
Client
```

The cursor is opaque, signed, and bound to the query context so that it cannot safely be reused with unrelated filters or sorting.

This design provides a stronger foundation for large product collections than loading the complete dataset into the browser.

---

# 6. Shopping Cart

The shopping cart is intentionally implemented as a **client-side concern**.

Cart state is stored in browser `localStorage`.

### Cart data

Only the following information is persisted:

```json
[
  {
    "productId": 1,
    "quantity": 2
  },
  {
    "productId": 5,
    "quantity": 1
  }
]
```

### Important design decision

The cart does **not** store:

* Product price
* Subtotal
* Total amount
* Stock quantity
* User ID
* Authentication token

Prices and stock are always authoritative on the backend.

### Cart functionality

* Add product
* Increase quantity
* Decrease quantity
* Remove item
* Clear cart
* Merge duplicate products
* Stock-aware quantity controls
* Cart item subtotals
* Cart summary
* Navigation cart count
* Safe malformed-localStorage handling

The browser is treated as an **untrusted client**. Cart information is only a temporary intent; the backend makes the final decision when an order is created.

---

# 7. Checkout & Order Processing

Order creation is one of the most important engineering areas of the project.

The frontend never determines the final order price.

### Checkout request

The client sends only:

```json
{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    },
    {
      "productId": 5,
      "quantity": 1
    }
  ]
}
```

Payment selection can also be supplied:

```json
{
  "payment": {
    "method": "CASH_ON_DELIVERY",
    "provider": null
  }
}
```

The browser does **not** send trusted:

* Prices
* Subtotals
* Total amounts
* Stock values
* User IDs

---

# 8. Server-Authoritative Order Architecture

When an order is created, the backend:

1. Authenticates the user.
2. Validates the request.
3. Merges duplicate product IDs.
4. Reads products from PostgreSQL.
5. Locks product rows with `FOR UPDATE`.
6. Validates product existence.
7. Validates current stock.
8. Reads the current database price.
9. Calculates each item subtotal.
10. Calculates the authoritative order total.
11. Calculates the delivery window.
12. Validates payment metadata.
13. Creates the order.
14. Creates order items.
15. Decrements inventory.
16. Commits the transaction.

All operations occur inside one PostgreSQL transaction.

```text
Browser Cart
(productId + quantity)
        │
        ▼
Authenticated Order API
        │
        ▼
Validate Request
        │
        ▼
Lock Product Rows
(FOR UPDATE)
        │
        ├── Validate stock
        ├── Read current price
        ├── Calculate totals
        └── Validate payment
        │
        ▼
Create Order
        │
        ▼
Create Order Items
        │
        ▼
Decrease Stock
        │
        ▼
COMMIT
```

If any step fails:

```text
ROLLBACK
```

This prevents partial orders and inconsistent inventory.

---

# 9. Inventory Consistency

Inventory is treated as shared mutable state and therefore requires database-level protection.

The system uses PostgreSQL row-level locking:

```sql
SELECT ...
FROM products
WHERE id = ANY($1)
FOR UPDATE;
```

This prevents concurrent order requests from consuming the same stock incorrectly.

### Guarantees

* Stock cannot become negative through concurrent order creation.
* Order creation and stock decrement succeed or fail together.
* Browser-provided prices are ignored.
* Browser-provided totals are ignored.
* Database state is authoritative.

---

# 10. Dummy Payment Experience

The project includes a **realistic payment-selection experience without implementing an actual payment gateway**.

Supported methods:

* Cash on Delivery
* Card
* Mobile Banking

The payment layer is intentionally designed as a safe abstraction rather than pretending that a real financial transaction has occurred.

### Security boundary

The application never accepts or stores:

* Full card numbers
* CVV
* PIN
* OTP
* Banking passwords
* Payment credentials

Only safe payment-selection metadata is persisted, such as:

* Payment method
* Provider
* Payment status

This keeps the assignment realistic while avoiding unsafe handling of financial credentials.

---

# 11. Order Lifecycle

Orders have an explicit lifecycle:

```text
pending
   │
   ▼
confirmed
   │
   ▼
processing
   │
   ▼
shipped
   │
   ▼
delivered
   │
   ▼
completed
```

An order can also transition to:

```text
cancelled
```

where cancellation is allowed only during appropriate early lifecycle states.

The backend, rather than the frontend, enforces valid lifecycle transitions.

---

# 12. Customer Order Cancellation

Customers can cancel their own eligible orders.

### Endpoint

```http
POST /api/orders/:id/cancel
```

### Cancellation flow

```text
Authenticated Customer
        │
        ▼
Verify Order Ownership
        │
        ▼
Verify Cancellable Status
        │
        ▼
Lock Order
        │
        ▼
Lock Related Product Rows
        │
        ▼
Restore Ordered Quantities
        │
        ▼
Record Cancellation Metadata
        │
        ▼
Update Payment Status
        │
        ▼
COMMIT
```

Cancellation is atomic and designed to be safe under repeated or concurrent requests.

The original order and order items are preserved for historical purposes rather than deleted.

---

# 13. Order History & Order Details

Authenticated customers can access:

```http
GET /api/orders
GET /api/orders/:id
```

The order system provides:

* Order history
* Order details
* Order items
* Historical prices
* Order totals
* Order lifecycle status
* Delivery estimate
* Payment method/status
* Cancellation information
* Loading/error/empty states

### Ownership protection

The authenticated user ID comes from the verified JWT.

The client cannot provide another user's ID to access their orders.

Cross-user order access is rejected without revealing whether the resource belongs to another customer.

---

# 14. Historical Order Accuracy

An order must remain historically correct even when a product changes later.

For that reason:

```text
products.price
       │
       │ snapshot at purchase time
       ▼
order_items.unit_price
```

`order_items.unit_price` stores the price at the time the order was created.

Therefore:

* Product price changes do not alter old orders.
* Historical totals remain accurate.
* Order history does not depend on the current product price.

All monetary values use PostgreSQL `NUMERIC(10,2)` rather than floating-point types.

---

# 15. Delivery Estimates

The system calculates and persists an estimated delivery window during order creation.

Current design:

**7–14 Monday–Friday working days after order placement.**

The dates are stored with the order rather than recalculated every time the order is viewed.

This makes the historical order record deterministic and auditable.

---

# 16. Product Ratings

The application also supports product rating functionality associated with completed/past purchases.

The rating experience is integrated into the order-detail/product experience rather than treated as an unrelated standalone feature.

This creates the foundation for purchase-based customer feedback while keeping the rating workflow connected to the order lifecycle.

---

# 17. Database Architecture

The application uses PostgreSQL as its source of truth.

### Core entities

```text
users
  │
  └──< orders
          │
          └──< order_items >── products
```

### Main tables

* `users`
* `products`
* `orders`
* `order_items`

Additional fields support:

* Order lifecycle
* Delivery estimates
* Payment metadata
* Cancellation metadata
* Product discovery
* Product availability
* Product metadata

### Relationships

```text
users 1 ──────── N orders

orders 1 ─────── N order_items

products 1 ──── N order_items
```

Foreign keys protect historical relationships and prevent accidental destruction of order history.

---

# 18. Database Migrations & Seed Strategy

Database initialization is designed to be **repeatable and non-destructive**.

The project separates:

* Base schema
* Migrations
* Seed data

The database setup process:

```text
Schema
  │
  ▼
Pending migrations
  │
  ▼
Seed data when appropriate
```

Migrations are tracked so previously applied changes are not executed again.

Seed data is only inserted when appropriate, preventing normal application restarts from overwriting developer changes.

This makes the local environment reproducible while preserving persistent development data.

---

# 19. Backend Architecture

The Express backend follows a layered structure:

```text
Request
   │
   ▼
Route
   │
   ▼
Controller
   │
   ▼
Service
   │
   ▼
PostgreSQL
```

Supporting layers include:

* Authentication middleware
* Error middleware
* Configuration
* Database access
* Validation
* Security middleware

### Main backend areas

```text
backend/
└── src/
    ├── server.js
    ├── config/
    ├── routes/
    ├── controllers/
    ├── services/
    └── middleware/
```

This separation prevents business logic from becoming tightly coupled to HTTP route definitions.

---

# 20. Frontend Architecture

The frontend intentionally uses plain web technologies:

```text
HTML
CSS
Vanilla JavaScript
```

There is no React, Vue, Angular, or other frontend framework.

Shared functionality is separated into reusable modules such as:

```text
frontend/js/
├── app.js
├── api.js
├── cart.js
├── cart-page.js
├── products.js
├── product-details.js
├── login.js
├── register.js
├── orders.js
└── order-details.js
```

### Responsibilities

**`api.js`**

Centralized backend communication.

**`app.js`**

Shared application/navigation behavior and authentication-aware UI.

**`cart.js`**

Centralized client-side cart state.

**Page-specific modules**

Handle rendering and interaction for individual application pages.

The frontend uses safe DOM manipulation and treats all backend/client data as untrusted input.

---

# 21. API Design

The backend exposes HTTP APIs for the application's core resources.

### Health

```http
GET /api/health
```

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Products

```http
GET /api/products
GET /api/products/:id
```

The product listing endpoint supports search, filtering, sorting, and cursor pagination.

### Orders

```http
POST /api/orders
GET  /api/orders
GET  /api/orders/:id
POST /api/orders/:id/cancel
```

The API maintains a consistent response/error model and separates authentication, authorization, validation, and business logic.

---

# 22. Validation & Error Handling

Input validation is applied at API boundaries.

Examples include:

* Positive integer product IDs
* Positive integer order IDs
* Valid email addresses
* Password requirements
* Password confirmation
* Non-empty order items
* Positive quantities
* Valid payment methods
* Valid product filters
* Valid pagination limits
* Valid cursor values

### HTTP error semantics

```text
400  Bad Request
401  Unauthorized
404  Not Found
409  Conflict
500  Internal Server Error
```

A centralized Express error middleware prevents implementation details, stack traces, and raw database errors from leaking to clients.

---

# 23. Security Engineering

Security is treated as a cross-cutting concern rather than a final checklist.

### Authentication

* JWT authentication
* HttpOnly cookies
* Minimal JWT payload
* Password hashing
* Secure cookie configuration
* Logout invalidation through cookie clearing

### Authorization

* Protected routes
* Ownership enforcement
* JWT-derived user identity
* No client-controlled user IDs for protected resources

### Database security

* Parameterized SQL
* No string-interpolated SQL
* Transactional writes
* Row-level locking
* Foreign-key constraints

### HTTP security

* Helmet
* Explicit CORS
* Credentialed requests
* No wildcard credentialed origins

### Client security

* No JWT in localStorage
* No sensitive payment credentials
* Cart treated as untrusted data
* Backend revalidation before order creation

The security hardening phase explicitly covers centralized errors, Helmet, validation, SQL injection prevention, authorization, cart validation, and secret auditing.

---

# 24. Testing Strategy

Testing is part of the development workflow rather than an afterthought.

The project uses **Jest** for automated testing.

Tests are intended to cover important business behavior such as:

* Authentication
* Product APIs
* Product search/filtering
* Cursor pagination
* Input validation
* Order creation
* Stock validation
* Transaction rollback
* Concurrent inventory access
* Order ownership
* Cancellation
* Cancellation idempotency
* Payment validation
* Historical order integrity

The testing strategy focuses particularly on **business invariants and failure paths**, not only successful requests.

---

# 25. Dockerized Development

The project can be started as a complete local stack using Docker Compose.

### Architecture

```text
                    Browser
                       │
                       ▼
              ┌────────────────┐
              │     Nginx      │
              │   Frontend     │
              │ Static + Proxy │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │    Express     │
              │    Backend     │
              └───────┬────────┘
                      │
                      ▼
              ┌────────────────┐
              │   PostgreSQL   │
              │    Database    │
              └───────┬────────┘
                      │
                      ▼
              Persistent Volume
```

### Services

* Frontend / Nginx
* Backend / Node.js + Express
* PostgreSQL
* Database initialization process

PostgreSQL is kept inside the Docker network by default, while the application communicates with it through the Compose service name rather than `localhost`.

---

# 26. Run with Docker

### Requirements

* Docker Desktop
* Docker Compose v2

### Start

```bash
git clone <repository-url>
cd <project-directory>

docker compose up -d
```

The first startup prepares the database, applies migrations, loads seed data where appropriate, and starts the application services.

### Frontend

```text
http://localhost:8080
```

### Backend health check

```text
http://localhost:5000/api/health
```

### Stop

```bash
docker compose down
```

### Rebuild

```bash
docker compose up -d --build
```

### Reset local database

```bash
docker compose down -v
docker compose up -d
```

> **Warning:** `docker compose down -v` deletes the PostgreSQL volume and all local database data.

The Docker setup uses a persistent named PostgreSQL volume so normal container shutdown does not destroy accounts, products, or orders.

---

# 27. Local Development Without Docker

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

Serve `/frontend` with a static development server such as VS Code Live Server.

### Database

```bash
cd backend
npm run db:setup
```

The database setup process applies the schema, pending migrations, and seed data when appropriate.

---

# 28. Environment Configuration

Secrets and environment-specific configuration are kept outside committed source code.

Example:

```env
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=1d
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
CORS_ORIGIN=http://localhost:5500
```

The repository contains environment templates such as:

```text
.env.example
```

Real `.env` files are excluded from Git.

No credentials, JWT secrets, or sensitive payment information are embedded in frontend JavaScript.

---

# 29. Project Structure

```text
simple-ecommerce-store/
│
├── frontend/
│   ├── index.html
│   ├── products.html
│   ├── product-details.html
│   ├── cart.html
│   ├── login.html
│   ├── register.html
│   ├── orders.html
│   ├── order-details.html
│   │
│   ├── css/
│   │   ├── style.css
│   │   ├── products.css
│   │   ├── product-details.css
│   │   ├── cart.css
│   │   ├── auth.css
│   │   └── orders.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── api.js
│   │   ├── cart.js
│   │   ├── cart-page.js
│   │   ├── products.js
│   │   ├── product-details.js
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── orders.js
│   │   └── order-details.js
│   │
│   └── assets/
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── middleware/
│   │
│   ├── database/
│   │   ├── schema.sql
│   │   ├── migrations/
│   │   └── seed.sql
│   │
│   ├── docs/
│   ├── tests/
│   ├── scripts/
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
├── frontend/nginx.conf
├── .dockerignore
├── .gitignore
└── README.md
```

The exact structure may evolve as additional engineering concerns are introduced; the architectural principle remains separation of responsibilities rather than putting application logic into a single large file.

---

# 30. Engineering Principles

The project follows several principles throughout development.

### Server authority

The browser is never trusted with authoritative business values.

```text
Client → intent
Server → decision
Database → source of truth
```

### Separation of concerns

Routes should not contain business logic.

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Database
```

### Atomicity

Operations that modify related pieces of business state should succeed or fail together.

### Explicit validation

Invalid data is rejected at the system boundary.

### Secure by default

Authentication, authorization, secrets, cookies, CORS, SQL queries, and error responses are designed with security in mind.

### Maintainability

Features are implemented in isolated layers and documented so future changes do not require rewriting unrelated functionality.

### Scalability

The implementation avoids unnecessarily coupling frontend state to backend persistence and avoids inefficient application-side filtering when the database can perform the operation.

### Observability and auditability

Important business events such as order creation and cancellation preserve enough historical state to understand what happened later.

---

# 31. Documentation

Documentation is treated as part of the engineering process.

The project maintains documentation for:

* API contracts
* Product search architecture
* Implementation phases
* Database behavior
* Docker setup
* Authentication
* Order lifecycle
* Testing
* Security decisions
* Development workflow

The purpose is to make the project understandable not only to its original author, but also to another developer who needs to inspect, maintain, debug, or extend it.

---

# 32. Development Approach

The application was developed incrementally rather than as one large implementation.

A typical feature lifecycle is:

```text
Requirement
    ↓
Architecture / design
    ↓
Database considerations
    ↓
Backend implementation
    ↓
Frontend integration
    ↓
Validation
    ↓
Testing
    ↓
Security review
    ↓
Documentation
    ↓
Integration
```

This approach helps prevent the common problem of implementing UI first and discovering later that the backend cannot safely support the intended business behavior.

---

# 33. Current Implementation Scope

The application currently covers the major e-commerce workflow:

```text
User
 │
 ├── Register / Login
 │
 ▼
Product Discovery
 │
 ├── Search
 ├── Filter
 ├── Sort
 └── Cursor Pagination
 │
 ▼
Product Details
 │
 ▼
Shopping Cart
 │
 ▼
Checkout
 │
 ├── Payment Method
 └── Shipping Information
 │
 ▼
Order Creation
 │
 ├── Validate Stock
 ├── Lock Inventory
 ├── Calculate Price
 ├── Create Order
 └── Decrease Stock
 │
 ▼
Order History
 │
 ▼
Order Details
 │
 ├── Lifecycle
 ├── Delivery Estimate
 ├── Payment Status
 └── Cancellation
 │
 ▼
Product Rating
```

---

# 34. Important Business Invariants

The following rules are intentionally enforced by the system.

### Pricing

> The client cannot decide the final order price.

### Inventory

> An order cannot consume more stock than currently exists.

### Authentication

> Authentication state is controlled by the server-side JWT cookie.

### Authorization

> A customer can access only their own protected order resources.

### Order history

> Historical order prices do not change when product prices change.

### Cancellation

> Cancellation restores inventory atomically and does not delete historical order records.

### Payment

> The application does not claim that a real payment has been processed.

### Database

> Related order and inventory changes are committed atomically.

These invariants are more important than any individual frontend implementation detail because they protect the integrity of the business system.

---

# 35. What This Project Is Designed to Show

This project is intentionally more than a basic CRUD demonstration.

It demonstrates practical understanding of:

* Full-stack application architecture
* REST API development
* Relational database design
* Authentication
* Authorization
* Secure cookies
* Input validation
* SQL safety
* Transactions
* Concurrency control
* Inventory management
* Historical data modeling
* Cursor pagination
* Search architecture
* Client/server responsibility boundaries
* Error handling
* Automated testing
* Docker
* Nginx
* Database migrations
* Seed management
* Documentation
* Maintainable code organization

The most important design principle throughout the project is:

> **The UI may be convenient, but the backend and database must remain authoritative.**

---

# 36. Project Status

The project is in the final integration/documentation stage.

The implementation has progressed through feature-focused phases covering:

* Application foundation
* Product catalog
* Authentication
* Product discovery
* Shopping cart
* Checkout
* Transaction-safe order processing
* Order lifecycle
* Cancellation
* Order history
* Payment experience
* Ratings
* Security hardening
* Dockerization
* Testing
* Integration
* Documentation

The current focus is ensuring that these features work together as one coherent application rather than treating them as isolated assignment features.

---

# 37. Final Perspective

**Simple E-commerce Store** started from a small internship specification, but the implementation intentionally applies the mindset used when building real software systems.

Instead of asking only:

> "Does the feature work?"

the project asks:

* What happens when two users buy the last item simultaneously?
* Can a client manipulate the order price?
* Can one customer access another customer's order?
* What happens when an order cancellation is repeated?
* What happens if a database operation fails halfway through checkout?
* Can historical orders change when product prices change?
* Can search scale beyond loading the entire catalog?
* Can the application be reproduced on another developer's machine?
* Can the database evolve safely through migrations?
* Can another developer understand the architecture?
* Can the system be tested without relying entirely on manual browser testing?
* Are secrets and sensitive payment information protected?

That engineering mindset is the central purpose of the project.

---

## Technology Summary

| Area               | Technology / Approach                    |
| ------------------ | ---------------------------------------- |
| Frontend           | HTML, CSS, Vanilla JavaScript            |
| Backend            | Node.js, Express.js                      |
| Database           | PostgreSQL                               |
| Authentication     | JWT + HttpOnly Cookie                    |
| Password Security  | bcrypt                                   |
| API Security       | Helmet, CORS, validation                 |
| Database Access    | Parameterized SQL                        |
| Transactions       | PostgreSQL transactions + `FOR UPDATE`   |
| Search             | PostgreSQL-backed search                 |
| Pagination         | Cursor / keyset pagination               |
| State              | Vanilla JS + localStorage cart           |
| Testing            | Jest                                     |
| Web Server         | Nginx                                    |
| Containers         | Docker + Docker Compose                  |
| Database Evolution | Schema + migrations                      |
| Initial Data       | Seed scripts                             |
| Documentation      | API + architecture + implementation docs |

---

## License

This project was created for educational and internship purposes as part of the **CodeAlpha Full Stack Software Development Internship — Task 1**.  
Design and Developed by **Showrav Kormokar**
