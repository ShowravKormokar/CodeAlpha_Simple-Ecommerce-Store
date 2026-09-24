-- ============================================================
-- Phase 01 — Seed Data (expanded product model)
-- Database: simpleEcommerce
-- ============================================================
-- Only products are seeded in this phase.
-- Users, orders, and order_items are populated in later phases
-- when authentication and order processing are implemented.
--
-- IMPORTANT: All monetary values use NUMERIC(10,2).
--
-- PRICING MODEL:
--   price          = effective selling price (what the customer pays)
--   regular_price  = base/normal price
--   offer_price    = discounted price (NULL when no offer)
--   offer_sale     = whether the offer is active
--
-- When offer_sale = true:  price = offer_price, offer_price < regular_price
-- When offer_sale = false: price = regular_price, offer_price = NULL
--
-- IDEMPOTENCY:
--   Uses INSERT ... ON CONFLICT (sku) DO UPDATE SET.
--   Skus are assigned by migration 003 for existing rows.
--   Running this seed multiple times will not create duplicates.
-- ============================================================

INSERT INTO products (
    sku, slug, name, brand, category, subcategory,
    description, short_description,
    price, regular_price, offer_price, offer_sale,
    image_url, stock_quantity, low_stock_threshold,
    is_active, is_featured,
    colors, sizes, variant, specifications,
    vendor, made_in, barcode, weight, unit, material, warranty, tags
) VALUES
    (
        'SKU-WM-001', 'wireless-mouse',
        'Wireless Mouse', 'Logitech', 'Electronics', 'Computer Accessories',
        'A simple wireless mouse for everyday use.',
        'A reliable 2.4GHz wireless mouse with ergonomic design and silent clicks.',
        25.99, 25.99, NULL, FALSE,
        'https://example.com/images/wireless-mouse.jpg',
        25, 5,
        TRUE, TRUE,
        ARRAY['Black', 'White']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Connectivity":"2.4GHz Wireless","Battery":"AA (not included)","Buttons":"3"}'::JSONB,
        'Logitech', 'China', NULL, NULL, 'piece', NULL, NULL,
        ARRAY['accessories', 'wireless', 'mouse']::TEXT[]
    ),
    (
        'SKU-MK-002', 'mechanical-keyboard',
        'Mechanical Keyboard', 'Corsair', 'Electronics', 'Computer Accessories',
        'Compact mechanical keyboard with tactile switches.',
        'Compact mechanical keyboard with tactile switches and per-key RGB backlighting.',
        69.99, 79.50, 69.99, TRUE,
        'https://example.com/images/mechanical-keyboard.jpg',
        18, 5,
        TRUE, FALSE,
        ARRAY['Black', 'White']::TEXT[], ARRAY[]::TEXT[], 'Tenkeyless',
        '{"Switch":"Cherry MX Brown","Layout":"TKL","Backlight":"RGB"}'::JSONB,
        'Corsair', 'China', NULL, NULL, 'piece', NULL, NULL,
        ARRAY['accessories', 'keyboard', 'mechanical']::TEXT[]
    ),
    (
        'SKU-UC-003', 'usb-c-charging-cable',
        'USB-C Charging Cable', 'Anker', 'Electronics', 'Accessories',
        'Durable 2-meter USB-C cable for fast charging.',
        'Durable 2-meter USB-C cable supporting fast charging and data transfer.',
        12.00, 12.00, NULL, FALSE,
        'https://example.com/images/usb-c-cable.jpg',
        100, 5,
        TRUE, FALSE,
        ARRAY['Black', 'White']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Length":"2m","Connector":"USB-C to USB-C","Fast Charging":"Yes"}'::JSONB,
        'Anker', 'Vietnam', NULL, NULL, 'piece', NULL, NULL,
        ARRAY['accessories', 'cable']::TEXT[]
    ),
    (
        'SKU-LS-004', 'laptop-stand',
        'Laptop Stand', 'Rain Design', 'Home & Office', 'Computer Accessories',
        'Adjustable aluminum laptop stand for ergonomic use.',
        'Adjustable aluminum laptop stand for ergonomic use and improved airflow.',
        34.99, 34.99, NULL, FALSE,
        'https://example.com/images/laptop-stand.jpg',
        15, 5,
        TRUE, FALSE,
        ARRAY['Silver']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Material":"Aluminum","Adjustable":"Yes","Compatibility":"Up to 17-inch"}'::JSONB,
        'Rain Design', 'USA', NULL, NULL, 'piece', 'Aluminum', NULL,
        ARRAY['accessories', 'stand']::TEXT[]
    ),
    (
        'SKU-BS-005', 'bluetooth-speaker',
        'Bluetooth Speaker', 'JBL', 'Electronics', 'Audio',
        'Portable waterproof Bluetooth speaker with 12h battery.',
        'Portable waterproof Bluetooth speaker with 12h battery life and rich bass.',
        42.99, 49.99, 42.99, TRUE,
        'https://example.com/images/bluetooth-speaker.jpg',
        30, 5,
        TRUE, TRUE,
        ARRAY['Black', 'Blue']::TEXT[], ARRAY[]::TEXT[], '12h Battery',
        '{"Battery":"12h","Waterproof":"IPX7","Connectivity":"Bluetooth 5.3"}'::JSONB,
        'JBL', 'China', NULL, NULL, 'piece', NULL, '1 year',
        ARRAY['audio', 'speaker', 'wireless', 'waterproof']::TEXT[]
    ),
    (
        'SKU-UF-006', 'usb-flash-drive-128gb',
        'USB Flash Drive 128GB', 'SanDisk', 'Electronics', 'Storage',
        'High-speed 128GB USB 3.1 flash drive.',
        'High-speed 128GB USB 3.1 flash drive with up to 120MB/s read speed.',
        19.75, 19.75, NULL, FALSE,
        'https://example.com/images/usb-flash-drive.jpg',
        60, 5,
        TRUE, FALSE,
        ARRAY['Black']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Capacity":"128GB","Interface":"USB 3.1","Speed":"Up to 120MB/s"}'::JSONB,
        'SanDisk', 'USA', NULL, NULL, 'piece', NULL, '5 years',
        ARRAY['storage', 'accessories']::TEXT[]
    ),
    (
        'SKU-WE-007', 'wireless-earbuds',
        'Wireless Earbuds', 'Sony', 'Electronics', 'Audio',
        'True wireless earbuds with active noise cancellation.',
        'True wireless earbuds with active noise cancellation and 6h battery life.',
        89.00, 89.00, NULL, FALSE,
        'https://example.com/images/wireless-earbuds.jpg',
        22, 5,
        TRUE, TRUE,
        ARRAY['Black', 'White']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Noise Cancellation":"Yes","Battery":"6h (24h with case)","Connectivity":"Bluetooth 5.2"}'::JSONB,
        'Sony', 'Japan', NULL, NULL, 'piece', NULL, '1 year',
        ARRAY['audio', 'earbuds', 'wireless', 'noise-cancelling']::TEXT[]
    ),
    (
        'SKU-ES-008', 'external-ssd-1tb',
        'External SSD 1TB', 'Samsung', 'Electronics', 'Storage',
        'Portable 1TB solid-state drive with USB-C interface.',
        'Portable 1TB solid-state drive with USB-C interface and NVMe speeds.',
        119.99, 119.99, NULL, FALSE,
        'https://example.com/images/external-ssd.jpg',
        12, 5,
        TRUE, FALSE,
        ARRAY['Black', 'Silver']::TEXT[], ARRAY[]::TEXT[], '1TB',
        '{"Capacity":"1TB","Interface":"USB 3.2 Gen 2","Read Speed":"Up to 1050MB/s"}'::JSONB,
        'Samsung', 'South Korea', NULL, 0.100, 'piece', NULL, '3 years',
        ARRAY['storage', 'ssd', 'portable']::TEXT[]
    ),
    (
        'SKU-MO-009', 'monitor-27-144hz',
        'Monitor 27" 144Hz', 'ASUS', 'Electronics', 'Monitors',
        '27-inch IPS gaming monitor with 144Hz refresh rate.',
        '27-inch IPS gaming monitor with 144Hz refresh rate and adaptive sync.',
        279.00, 299.00, 279.00, TRUE,
        'https://example.com/images/monitor-27.jpg',
        8, 5,
        TRUE, TRUE,
        ARRAY['Black']::TEXT[], ARRAY[]::TEXT[], '27-inch',
        '{"Size":"27 inch","Refresh Rate":"144Hz","Panel":"IPS","Resolution":"2560x1440"}'::JSONB,
        'ASUS', 'Taiwan', NULL, 5.500, 'piece', NULL, '3 years',
        ARRAY['monitor', 'gaming', 'display']::TEXT[]
    ),
    (
        'SKU-WC-010', 'webcam-1080p',
        'Webcam 1080p', 'Logitech', 'Electronics', 'Computer Accessories',
        'Full HD webcam with auto-focus and built-in microphone.',
        'Full HD 1080p webcam with auto-focus and built-in stereo microphone.',
        45.50, 45.50, NULL, FALSE,
        'https://example.com/images/webcam.jpg',
        20, 5,
        TRUE, FALSE,
        ARRAY['Black']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Resolution":"1080p","Focus":"Auto-focus","Microphone":"Built-in","Frame Rate":"30fps"}'::JSONB,
        'Logitech', 'China', NULL, 0.200, 'piece', NULL, '2 years',
        ARRAY['accessories', 'webcam']::TEXT[]
    ),
    (
        'SKU-DL-011', 'desk-lamp-led',
        'Desk Lamp LED', 'Philips', 'Home & Office', 'Lighting',
        'Adjustable LED desk lamp with touch controls.',
        'Adjustable LED desk lamp with touch controls and multiple brightness levels.',
        28.99, 28.99, NULL, FALSE,
        'https://example.com/images/desk-lamp.jpg',
        14, 5,
        TRUE, FALSE,
        ARRAY['Black', 'White']::TEXT[], ARRAY[]::TEXT[], NULL,
        '{"Brightness":"Adjustable","Controls":"Touch","Power Source":"USB-C"}'::JSONB,
        'Philips', 'China', NULL, 1.200, 'piece', NULL, '2 years',
        ARRAY['home', 'lighting', 'desk']::TEXT[]
    ),
    (
        'SKU-NH-012', 'noise-cancelling-headphones',
        'Noise-Cancelling Headphones', 'Sony', 'Electronics', 'Audio',
        'Over-ear noise-cancelling headphones with 30h battery.',
        'Over-ear noise-cancelling headphones with 30h battery life and premium sound.',
        129.00, 159.00, 129.00, TRUE,
        'https://example.com/images/headphones.jpg',
        9, 5,
        TRUE, TRUE,
        ARRAY['Black', 'Silver']::TEXT[], ARRAY[]::TEXT[], 'Over-Ear',
        '{"Noise Cancellation":"Yes","Battery":"30h","Connectivity":"Bluetooth 5.3","Type":"Over-ear"}'::JSONB,
        'Sony', 'Japan', NULL, 0.250, 'piece', NULL, '1 year',
        ARRAY['audio', 'headphones', 'noise-cancelling']::TEXT[]
    )
ON CONFLICT (sku) DO UPDATE SET
    name              = EXCLUDED.name,
    slug              = EXCLUDED.slug,
    brand             = EXCLUDED.brand,
    category          = EXCLUDED.category,
    subcategory       = EXCLUDED.subcategory,
    description       = EXCLUDED.description,
    short_description = EXCLUDED.short_description,
    price             = EXCLUDED.price,
    regular_price     = EXCLUDED.regular_price,
    offer_price       = EXCLUDED.offer_price,
    offer_sale        = EXCLUDED.offer_sale,
    image_url         = EXCLUDED.image_url,
    stock_quantity    = EXCLUDED.stock_quantity,
    low_stock_threshold = EXCLUDED.low_stock_threshold,
    is_active         = EXCLUDED.is_active,
    is_featured       = EXCLUDED.is_featured,
    colors            = EXCLUDED.colors,
    sizes             = EXCLUDED.sizes,
    variant           = EXCLUDED.variant,
    specifications    = EXCLUDED.specifications,
    vendor            = EXCLUDED.vendor,
    made_in           = EXCLUDED.made_in,
    barcode           = EXCLUDED.barcode,
    weight            = EXCLUDED.weight,
    unit              = EXCLUDED.unit,
    material          = EXCLUDED.material,
    warranty          = EXCLUDED.warranty,
    tags              = EXCLUDED.tags;