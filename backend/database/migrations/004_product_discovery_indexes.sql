CREATE INDEX IF NOT EXISTS idx_products_active_created_id
    ON products (created_at DESC, id DESC)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_active_price_id
    ON products (price ASC, id ASC)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_active_name_id
    ON products (name ASC, id ASC)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_active_category_brand_id
    ON products (category, brand, id)
    WHERE is_active = TRUE;
