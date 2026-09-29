-- ============================================================
-- Migration 001 — Add rating columns to order_items
-- ============================================================
-- Adds optional 1–5 star rating per order item.
-- Existing rows remain valid with rating = NULL, rated_at = NULL.
-- ============================================================

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS rating INTEGER,
    ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;

-- Enforce 1–5 range when a rating is provided.
-- PostgreSQL has no "ADD CONSTRAINT IF NOT EXISTS", so the constraint is dropped
-- first. database/schema.sql already creates it, and without this line a fresh
-- database (schema.sql followed by this migration) fails with
-- 'constraint "chk_order_items_rating_range" for relation "order_items" already exists'.
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS chk_order_items_rating_range;

ALTER TABLE order_items
    ADD CONSTRAINT chk_order_items_rating_range
    CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

-- Index to quickly find rated items for a product (average rating queries).
CREATE INDEX IF NOT EXISTS idx_order_items_product_rated
    ON order_items (product_id)
    WHERE rating IS NOT NULL;