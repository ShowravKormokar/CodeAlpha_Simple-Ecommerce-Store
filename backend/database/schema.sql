-- ============================================================
-- Phase 02 — PostgreSQL Schema
-- Database: simpleEcommerce
-- ============================================================
--
-- Table creation order is important because of foreign keys:
--   users      (no dependencies)
--   products   (no dependencies)
--   orders     (depends on users)
--   order_items (depends on orders and products)
--
-- Foreign key behavior notes:
--   We deliberately avoid ON DELETE CASCADE on historical
--   relationships (orders, order_items) so that deleting a
--   user or product does not silently destroy order history.
--   Instead we use ON DELETE RESTRICT (the default) which
--   prevents deletion of referenced rows. This keeps the
--   data model safe and predictable for an e-commerce store.
-- ============================================================

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE users (
    id            BIGSERIAL      PRIMARY KEY,
    name          VARCHAR(255)   NOT NULL,
    email         VARCHAR(255)   NOT NULL UNIQUE,
    password_hash TEXT           NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- email is already indexed by the UNIQUE constraint;
-- no duplicate manual index is needed.

-- ------------------------------------------------------------
-- products
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
CREATE TABLE orders (
    id            BIGSERIAL       PRIMARY KEY,
    user_id       BIGINT          NOT NULL,
    total_amount  NUMERIC(10,2)   NOT NULL CHECK (total_amount >= 0),
    status        VARCHAR(50)     NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Index to speed up lookups of a user's order history.
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
CREATE TABLE order_items (
    id          BIGSERIAL       PRIMARY KEY,
    order_id    BIGINT          NOT NULL,
    product_id  BIGINT          NOT NULL,
    quantity    INTEGER         NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10,2)   NOT NULL CHECK (unit_price >= 0),
    subtotal    NUMERIC(10,2)   NOT NULL CHECK (subtotal >= 0),
    rating      INTEGER,                              -- 1–5, NULL = not yet rated
    rated_at    TIMESTAMPTZ,                            -- when the rating was submitted
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT chk_order_items_rating_range
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5)
);

-- Indexes for the most common relationship lookups.
CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
CREATE INDEX idx_order_items_product_rated ON order_items (product_id)
    WHERE rating IS NOT NULL;