-- Add shipping address fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS shipping_address_line1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_address_line2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS shipping_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS shipping_country VARCHAR(100);