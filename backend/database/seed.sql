-- ============================================================
-- Phase 02 — Seed Data
-- Database: simpleEcommerce
-- ============================================================
-- Only products are seeded in this phase.
-- Users, orders, and order_items are populated in later phases
-- when authentication and order processing are implemented.
--
-- IMPORTANT: All monetary values use NUMERIC(10,2).
--            All subtotals are mathematically consistent:
--            subtotal = quantity × unit_price
-- ============================================================

INSERT INTO products
    (name, description, price, image_url, stock_quantity)
VALUES
    (
        'Wireless Mouse',
        'A simple wireless mouse for everyday use.',
        25.99,
        'https://example.com/images/wireless-mouse.jpg',
        25
    ),
    (
        'Mechanical Keyboard',
        'Compact mechanical keyboard with tactile switches.',
        79.50,
        'https://example.com/images/mechanical-keyboard.jpg',
        18
    ),
    (
        'USB-C Charging Cable',
        'Durable 2-meter USB-C cable for fast charging.',
        12.00,
        'https://example.com/images/usb-c-cable.jpg',
        100
    ),
    (
        'Laptop Stand',
        'Adjustable aluminum laptop stand for ergonomic use.',
        34.99,
        'https://example.com/images/laptop-stand.jpg',
        15
    ),
    (
        'Bluetooth Speaker',
        'Portable waterproof Bluetooth speaker with 12h battery.',
        49.99,
        'https://example.com/images/bluetooth-speaker.jpg',
        30
    ),
    (
        'USB Flash Drive 128GB',
        'High-speed 128GB USB 3.1 flash drive.',
        19.75,
        'https://example.com/images/usb-flash-drive.jpg',
        60
    ),
    (
        'Wireless Earbuds',
        'True wireless earbuds with active noise cancellation.',
        89.00,
        'https://example.com/images/wireless-earbuds.jpg',
        22
    ),
    (
        'External SSD 1TB',
        'Portable 1TB solid-state drive with USB-C interface.',
        119.99,
        'https://example.com/images/external-ssd.jpg',
        12
    ),
    (
        'Monitor 27" 144Hz',
        '27-inch IPS gaming monitor with 144Hz refresh rate.',
        299.00,
        'https://example.com/images/monitor-27.jpg',
        8
    ),
    (
        'Webcam 1080p',
        'Full HD webcam with auto-focus and built-in microphone.',
        45.50,
        'https://example.com/images/webcam.jpg',
        20
    ),
    (
        'Desk Lamp LED',
        'Adjustable LED desk lamp with touch controls.',
        28.99,
        'https://example.com/images/desk-lamp.jpg',
        14
    ),
    (
        'Noise-Cancelling Headphones',
        'Over-ear noise-cancelling headphones with 30h battery.',
        159.00,
        'https://example.com/images/headphones.jpg',
        9
    );