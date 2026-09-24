-- ============================================================
-- Migration 003 — Expand product model (Phase 01)
-- ============================================================
-- Adds new e-commerce product metadata columns.
-- Existing columns (id, name, description, price, image_url,
-- stock_quantity, created_at, updated_at) are preserved.
-- This migration is idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- New columns (all additive, no destructive operations)
-- ------------------------------------------------------------

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS slug                 VARCHAR(255),
    ADD COLUMN IF NOT EXISTS sku                  VARCHAR(100),
    ADD COLUMN IF NOT EXISTS brand                VARCHAR(255),
    ADD COLUMN IF NOT EXISTS category             VARCHAR(255),
    ADD COLUMN IF NOT EXISTS subcategory          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS short_description    TEXT,
    ADD COLUMN IF NOT EXISTS regular_price        NUMERIC(10,2) CHECK (regular_price >= 0),
    ADD COLUMN IF NOT EXISTS offer_price          NUMERIC(10,2) CHECK (offer_price >= 0),
    ADD COLUMN IF NOT EXISTS offer_sale           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS low_stock_threshold  INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    ADD COLUMN IF NOT EXISTS is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_featured          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS colors               TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS sizes                TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS variant              TEXT,
    ADD COLUMN IF NOT EXISTS specifications       JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS vendor               TEXT,
    ADD COLUMN IF NOT EXISTS made_in              TEXT,
    ADD COLUMN IF NOT EXISTS barcode              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS weight               NUMERIC(10,3) CHECK (weight >= 0),
    ADD COLUMN IF NOT EXISTS unit                 VARCHAR(50),
    ADD COLUMN IF NOT EXISTS material             TEXT,
    ADD COLUMN IF NOT EXISTS warranty             TEXT,
    ADD COLUMN IF NOT EXISTS tags                 TEXT[] NOT NULL DEFAULT '{}';

-- ------------------------------------------------------------
-- Backfill existing products so they have valid data in
-- the new columns. These UPDATEs only affect rows that have
-- NULL values, so they are safe to re-run.
-- ------------------------------------------------------------

-- slug: generate from name if not already set
UPDATE products
   SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
 WHERE slug IS NULL;

-- regular_price: default to current price if not set
UPDATE products
   SET regular_price = price
 WHERE regular_price IS NULL;

-- offer_sale: default to FALSE for existing rows (already the column default,
-- but set explicitly for clarity on pre-existing rows that may have been
-- inserted before the column existed)
UPDATE products
   SET offer_sale = FALSE
 WHERE offer_sale IS DISTINCT FROM FALSE;

-- is_active: default to TRUE for existing products
UPDATE products
   SET is_active = TRUE
 WHERE is_active IS DISTINCT FROM TRUE;

-- is_featured: default to FALSE for existing products
UPDATE products
   SET is_featured = FALSE
 WHERE is_featured IS DISTINCT FROM FALSE;

-- ------------------------------------------------------------
-- Assign SKUs to existing products (matched by name) so that
-- the seed script's ON CONFLICT (sku) can match them.
-- Only sets SKU where one is not already present.
-- ------------------------------------------------------------

UPDATE products SET sku = 'SKU-WM-001' WHERE sku IS NULL AND name = 'Wireless Mouse';
UPDATE products SET sku = 'SKU-MK-002' WHERE sku IS NULL AND name = 'Mechanical Keyboard';
UPDATE products SET sku = 'SKU-UC-003' WHERE sku IS NULL AND name = 'USB-C Charging Cable';
UPDATE products SET sku = 'SKU-LS-004' WHERE sku IS NULL AND name = 'Laptop Stand';
UPDATE products SET sku = 'SKU-BS-005' WHERE sku IS NULL AND name = 'Bluetooth Speaker';
UPDATE products SET sku = 'SKU-UF-006' WHERE sku IS NULL AND name = 'USB Flash Drive 128GB';
UPDATE products SET sku = 'SKU-WE-007' WHERE sku IS NULL AND name = 'Wireless Earbuds';
UPDATE products SET sku = 'SKU-ES-008' WHERE sku IS NULL AND name = 'External SSD 1TB';
UPDATE products SET sku = 'SKU-MO-009' WHERE sku IS NULL AND name = 'Monitor 27" 144Hz';
UPDATE products SET sku = 'SKU-WC-010' WHERE sku IS NULL AND name = 'Webcam 1080p';
UPDATE products SET sku = 'SKU-DL-011' WHERE sku IS NULL AND name = 'Desk Lamp LED';
UPDATE products SET sku = 'SKU-NH-012' WHERE sku IS NULL AND name = 'Noise-Cancelling Headphones';

-- ------------------------------------------------------------
-- Constraints and indexes
-- ------------------------------------------------------------

-- Unique SKU: PostgreSQL treats NULLs as distinct in a UNIQUE constraint,
-- so multiple products with sku = NULL are allowed. Once a SKU is assigned,
-- it must be unique.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_products_sku'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT uk_products_sku UNIQUE (sku);
  END IF;
END $$;

-- Unique slug (prevents duplicate URL slugs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uk_products_slug'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT uk_products_slug UNIQUE (slug);
  END IF;
END $$;

-- Index to speed up filtering by is_active on the listing endpoint
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);

-- Index to speed up featured product queries
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products (is_featured);
