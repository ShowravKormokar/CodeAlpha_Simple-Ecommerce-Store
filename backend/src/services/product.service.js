const pool = require("../config/database");

const PRODUCT_COLUMNS = [
  "id",
  "name",
  "slug",
  "sku",
  "brand",
  "category",
  "subcategory",
  "description",
  "short_description",
  "price",
  "regular_price",
  "offer_price",
  "offer_sale",
  "image_url",
  "stock_quantity",
  "low_stock_threshold",
  "is_active",
  "is_featured",
  "colors",
  "sizes",
  "variant",
  "specifications",
  "vendor",
  "made_in",
  "barcode",
  "weight",
  "unit",
  "material",
  "warranty",
  "tags",
  "created_at",
  "updated_at",
];

const ORDER_COLUMNS = ["id", "name", "price", "stock_quantity"];

// Calculate average rating and count for a single product.
// Only rows with rating IS NOT NULL are counted.
async function getProductRatingSummary(productId) {
  const result = await pool.query(
    `SELECT
        COUNT(*)              AS rating_count,
        COALESCE(AVG(oi.rating), 0) AS average_rating
     FROM order_items oi
     WHERE oi.product_id = $1
       AND oi.rating IS NOT NULL`,
    [productId]
  );

  const row = result.rows[0];
  const count = Number(row.rating_count);
  const average = count > 0
    ? Math.round(Number(row.average_rating) * 10) / 10
    : 0;

  return { average, count };
}

// Attach rating summaries to each product in a list.
async function attachRatingSummaries(products) {
  if (!products || products.length === 0) return products;

  const summaries = await Promise.all(
    products.map((p) => getProductRatingSummary(p.id))
  );

  return products.map((product, index) => ({
    ...product,
    rating: summaries[index],
  }));
}

// Normalize money values: NUMERIC comes back as string from pg;
// convert to a JS number or null.
function normalizeMoney(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Normalize a TEXT[] column: ensure it is always an array (never null).
function normalizeTextArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim() !== "");
}

// Normalize JSONB: ensure it is always an object (never null).
function normalizeJsonb(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (_) {
      return {};
    }
  }
  return {};
}

// Map a raw DB row to the API response shape.
// Ensures consistent representation of optional fields and money.
function mapProductToApi(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    brand: row.brand,
    category: row.category,
    subcategory: row.subcategory,
    description: row.description,
    short_description: row.short_description,
    price: normalizeMoney(row.price),
    regular_price: normalizeMoney(row.regular_price),
    offer_price: normalizeMoney(row.offer_price),
    offer_sale: Boolean(row.offer_sale),
    image_url: row.image_url,
    stock_quantity: Number(row.stock_quantity),
    low_stock_threshold: Number(row.low_stock_threshold),
    is_active: Boolean(row.is_active),
    is_featured: Boolean(row.is_featured),
    colors: normalizeTextArray(row.colors),
    sizes: normalizeTextArray(row.sizes),
    variant: row.variant,
    specifications: normalizeJsonb(row.specifications),
    vendor: row.vendor,
    made_in: row.made_in,
    barcode: row.barcode,
    weight: normalizeMoney(row.weight),
    unit: row.unit,
    material: row.material,
    warranty: row.warranty,
    tags: normalizeTextArray(row.tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Build the SELECT query for products, optionally filtered.
function buildProductsQuery(options = {}) {
  const { featuredOnly = false } = options;
  const columns = PRODUCT_COLUMNS.join(", ");

  let whereClause = "WHERE is_active = TRUE";
  if (featuredOnly) {
    whereClause += " AND is_featured = TRUE";
  }

  return `SELECT ${columns} FROM products ${whereClause} ORDER BY id ASC`;
}

async function getProducts(options = {}) {
  const query = buildProductsQuery(options);
  const result = await pool.query(query);
  const mapped = result.rows.map(mapProductToApi);
  return attachRatingSummaries(mapped);
}

async function getProductById(id) {
  const result = await pool.query(
    `SELECT ${PRODUCT_COLUMNS.join(", ")}
       FROM products
       WHERE id = $1`,
    [id]
  );

  const product = result.rows[0] || null;
  if (!product) return null;

  const summary = await getProductRatingSummary(id);
  return { ...mapProductToApi(product), rating: summary };
}

// Look up a set of products by ID (used by order service).
// Returns raw rows with only the columns needed for order processing.
async function getProductsByIds(productIds) {
  const result = await pool.query(
    `SELECT ${ORDER_COLUMNS.join(", ")}
       FROM products
       WHERE id = ANY($1)`,
    [productIds]
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Validation utilities
// ---------------------------------------------------------------------------

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidMoney(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "number" && typeof value !== "string") return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

function isValidBoolean(value) {
  if (value === null || value === undefined) return true;
  return value === true || value === false || value === 1 || value === 0
    || value === "true" || value === "false";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }
  return false;
}

function validateTextArray(value) {
  if (!Array.isArray(value)) {
    return { error: "Field must be an array" };
  }

  const cleaned = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return { error: "Array elements must be strings" };
    }
    const trimmed = item.trim();
    if (trimmed === "") {
      return { error: "Array elements must not be empty" };
    }
    if (!cleaned.includes(trimmed)) {
      cleaned.push(trimmed);
    }
  }

  return { value: cleaned };
}

function validateSpecifications(value) {
  if (value === null || value === undefined) {
    return { value: {} };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return { error: "specifications must be a JSON object" };
  }

  return { value };
}

function validateProduct(data) {
  const errors = [];

  if (!isNonEmptyString(data.name)) {
    errors.push("name is required and must be a non-empty string");
  }

  if (!isNonEmptyString(data.slug)) {
    errors.push("slug is required and must be a non-empty string");
  }

  if (data.sku !== null && data.sku !== undefined && !isNonEmptyString(data.sku)) {
    errors.push("sku must be a non-empty string when provided");
  }

  if (!isValidMoney(data.price)) {
    errors.push("price must be a non-negative number");
  }

  if (!isValidMoney(data.regular_price)) {
    errors.push("regular_price must be a non-negative number when provided");
  }

  if (data.regular_price !== null && data.regular_price !== undefined) {
    const reg = Number(data.regular_price);
    if (Number.isFinite(reg) && reg < 0) {
      errors.push("regular_price must be >= 0");
    }
  }

  if (!isValidMoney(data.offer_price)) {
    errors.push("offer_price must be a non-negative number when provided");
  }

  if (data.offer_price !== null && data.offer_price !== undefined) {
    const off = Number(data.offer_price);
    if (Number.isFinite(off) && off < 0) {
      errors.push("offer_price must be >= 0");
    }
  }

  const offerSale = normalizeBoolean(data.offer_sale);
  if (offerSale) {
    if (data.offer_price === null || data.offer_price === undefined) {
      errors.push("offer_price is required when offer_sale is true");
    } else {
      const reg = data.regular_price !== null && data.regular_price !== undefined
        ? Number(data.regular_price)
        : null;
      const off = Number(data.offer_price);
      if (reg !== null && Number.isFinite(reg) && Number.isFinite(off)) {
        if (off >= reg) {
          errors.push("offer_price must be less than regular_price when offer_sale is true");
        }
      }
    }
  }

  if (!isValidMoney(data.stock_quantity)) {
    errors.push("stock_quantity must be a non-negative integer");
  }

  if (!isValidMoney(data.low_stock_threshold)) {
    errors.push("low_stock_threshold must be a non-negative integer");
  }

  if (data.brand !== null && data.brand !== undefined && typeof data.brand !== "string") {
    errors.push("brand must be a string or null");
  }

  if (data.category !== null && data.category !== undefined && typeof data.category !== "string") {
    errors.push("category must be a string or null");
  }

  if (data.subcategory !== null && data.subcategory !== undefined && typeof data.subcategory !== "string") {
    errors.push("subcategory must be a string or null");
  }

  if (data.short_description !== null && data.short_description !== undefined && typeof data.short_description !== "string") {
    errors.push("short_description must be a string or null");
  }

  if (data.variant !== null && data.variant !== undefined && typeof data.variant !== "string") {
    errors.push("variant must be a string or null");
  }

  if (data.vendor !== null && data.vendor !== undefined && typeof data.vendor !== "string") {
    errors.push("vendor must be a string or null");
  }

  if (data.made_in !== null && data.made_in !== undefined && typeof data.made_in !== "string") {
    errors.push("made_in must be a string or null");
  }

  if (data.barcode !== null && data.barcode !== undefined && typeof data.barcode !== "string") {
    errors.push("barcode must be a string or null");
  }

  if (!isValidMoney(data.weight)) {
    errors.push("weight must be a non-negative number when provided");
  }

  if (data.unit !== null && data.unit !== undefined && typeof data.unit !== "string") {
    errors.push("unit must be a string or null");
  }

  if (data.material !== null && data.material !== undefined && typeof data.material !== "string") {
    errors.push("material must be a string or null");
  }

  if (data.warranty !== null && data.warranty !== undefined && typeof data.warranty !== "string") {
    errors.push("warranty must be a string or null");
  }

  if (data.colors !== undefined) {
    const result = validateTextArray(data.colors);
    if (result.error) errors.push(`colors: ${result.error}`);
  }

  if (data.sizes !== undefined) {
    const result = validateTextArray(data.sizes);
    if (result.error) errors.push(`sizes: ${result.error}`);
  }

  if (data.tags !== undefined) {
    const result = validateTextArray(data.tags);
    if (result.error) errors.push(`tags: ${result.error}`);
  }

  const specResult = validateSpecifications(data.specifications);
  if (specResult.error) {
    errors.push(`specifications: ${specResult.error}`);
  }

  if (!isValidBoolean(data.is_active)) {
    errors.push("is_active must be a boolean");
  }

  if (!isValidBoolean(data.is_featured)) {
    errors.push("is_featured must be a boolean");
  }

  return {
    valid: errors.length === 0,
    errors,
    // Return normalized values for use by callers
    normalized: {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      brand: data.brand || null,
      category: data.category || null,
      subcategory: data.subcategory || null,
      description: data.description || null,
      short_description: data.short_description || null,
      price: Number(data.price),
      regular_price: data.regular_price !== null && data.regular_price !== undefined
        ? Number(data.regular_price)
        : null,
      offer_price: data.offer_price !== null && data.offer_price !== undefined
        ? Number(data.offer_price)
        : null,
      offer_sale: offerSale,
      image_url: data.image_url || null,
      stock_quantity: Number(data.stock_quantity),
      low_stock_threshold: data.low_stock_threshold !== null && data.low_stock_threshold !== undefined
        ? Number(data.low_stock_threshold)
        : 5,
      is_active: normalizeBoolean(data.is_active),
      is_featured: normalizeBoolean(data.is_featured),
      colors: data.colors !== undefined ? validateTextArray(data.colors).value : [],
      sizes: data.sizes !== undefined ? validateTextArray(data.sizes).value : [],
      variant: data.variant || null,
      specifications: specResult.value,
      vendor: data.vendor || null,
      made_in: data.made_in || null,
      barcode: data.barcode || null,
      weight: data.weight !== null && data.weight !== undefined ? Number(data.weight) : null,
      unit: data.unit || null,
      material: data.material || null,
      warranty: data.warranty || null,
      tags: data.tags !== undefined ? validateTextArray(data.tags).value : [],
    },
  };
}

module.exports = {
  getProducts,
  getProductById,
  getProductsByIds,
  validateProduct,
  mapProductToApi,
  normalizeMoney,
  normalizeTextArray,
  normalizeJsonb,
  ORDER_COLUMNS,
  PRODUCT_COLUMNS,
};
