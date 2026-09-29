const crypto = require("crypto");
const pool = require("../config/database");
const {
  PRODUCT_COLUMNS,
  mapProductToApi,
} = require("./product.service");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const CURSOR_VERSION = 1;
const SEARCH_FIELDS = [
  "name",
  "sku",
  "brand",
  "category",
  "subcategory",
  "description",
  "short_description",
];
const SORT_DEFINITIONS = {
  id_asc: {
    fields: ["id"],
    directions: ["ASC"],
    sql: "p.id ASC",
  },
  newest: {
    fields: ["created_at", "id"],
    directions: ["DESC", "DESC"],
    sql: "p.created_at DESC, p.id DESC",
  },
  oldest: {
    fields: ["created_at", "id"],
    directions: ["ASC", "ASC"],
    sql: "p.created_at ASC, p.id ASC",
  },
  price_asc: {
    fields: ["price", "id"],
    directions: ["ASC", "ASC"],
    sql: "p.price ASC, p.id ASC",
  },
  price_desc: {
    fields: ["price", "id"],
    directions: ["DESC", "DESC"],
    sql: "p.price DESC, p.id DESC",
  },
  name_asc: {
    fields: ["name", "id"],
    directions: ["ASC", "ASC"],
    sql: "p.name ASC, p.id ASC",
  },
  name_desc: {
    fields: ["name", "id"],
    directions: ["DESC", "DESC"],
    sql: "p.name DESC, p.id DESC",
  },
  featured: {
    fields: ["is_featured", "created_at", "id"],
    directions: ["DESC", "DESC", "DESC"],
    sql: "p.is_featured DESC, p.created_at DESC, p.id DESC",
  },
};
const ALLOWED_QUERY_KEYS = new Set([
  "q",
  "category",
  "brand",
  "subcategory",
  "featured",
  "sale",
  "min_price",
  "max_price",
  "in_stock",
  "sort",
  "limit",
  "cursor",
]);

function queryError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_QUERY_PARAMETER";
  return error;
}

function cursorError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "INVALID_CURSOR";
  return error;
}

function readScalar(value, name) {
  if (Array.isArray(value) || (value !== null && typeof value === "object")) {
    throw queryError(`Query parameter '${name}' must have a single value`);
  }
  return value;
}

function readText(query, name, maxLength) {
  const value = readScalar(query[name], name);
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw queryError(`Query parameter '${name}' must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw queryError(`Query parameter '${name}' is too long`);
  }
  return normalized;
}

function readBoolean(query, name) {
  const value = readScalar(query[name], name);
  if (value === undefined) return undefined;
  if (value !== "true" && value !== "false") {
    throw queryError(`Query parameter '${name}' must be true or false`);
  }
  return value === "true";
}

function readNumber(query, name) {
  const value = readScalar(query[name], name);
  if (value === undefined) return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw queryError(`Query parameter '${name}' must be a non-negative number`);
  }
  const normalized = String(value).trim();
  if (normalized === "" || !/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw queryError(`Query parameter '${name}' must be a non-negative number`);
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    throw queryError(`Query parameter '${name}' must be a non-negative number`);
  }
  return number;
}

function normalizeContextValue(value, key) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  return key === "q" ? normalized.split(/\s+/).filter(Boolean).join(" ") : normalized;
}

function buildContext(query) {
  const normalized = {};
  for (const key of ["q", "category", "brand", "subcategory", "min_price", "max_price"]) {
    if (query[key] !== undefined) normalized[key] = normalizeContextValue(query[key], key);
  }
  for (const key of ["featured", "sale", "in_stock"]) {
    if (query[key] !== undefined) normalized[key] = query[key];
  }
  normalized.sort = query.sort;
  return JSON.stringify(normalized);
}

function parseQuery(rawQuery) {
  const query = rawQuery || {};
  for (const key of Object.keys(query)) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      throw queryError(`Unknown query parameter '${key}'`);
    }
  }

  const parsed = {
    q: readText(query, "q", 200),
    category: readText(query, "category", 255),
    brand: readText(query, "brand", 255),
    subcategory: readText(query, "subcategory", 255),
    featured: readBoolean(query, "featured"),
    sale: readBoolean(query, "sale"),
    minPrice: readNumber(query, "min_price"),
    maxPrice: readNumber(query, "max_price"),
    inStock: readBoolean(query, "in_stock"),
    sort: readText(query, "sort", 20) || "id_asc",
    limit: DEFAULT_LIMIT,
    cursor: readScalar(query.cursor, "cursor"),
  };

  if (query.limit !== undefined) {
    const rawLimit = readScalar(query.limit, "limit");
    if (!/^\d+$/.test(String(rawLimit))) {
      throw queryError("Query parameter 'limit' must be an integer between 1 and 100");
    }
    parsed.limit = Number(rawLimit);
    if (parsed.limit < 1 || parsed.limit > MAX_LIMIT) {
      throw queryError("Query parameter 'limit' must be an integer between 1 and 100");
    }
  }

  if (parsed.minPrice !== undefined && parsed.maxPrice !== undefined && parsed.minPrice > parsed.maxPrice) {
    throw queryError("Query parameter 'min_price' must not exceed 'max_price'");
  }

  if (!SORT_DEFINITIONS[parsed.sort]) {
    throw queryError(`Unsupported sort '${parsed.sort}'`);
  }

  parsed.context = buildContext({
    q: parsed.q,
    category: parsed.category,
    brand: parsed.brand,
    subcategory: parsed.subcategory,
    featured: parsed.featured,
    sale: parsed.sale,
    min_price: parsed.minPrice,
    max_price: parsed.maxPrice,
    in_stock: parsed.inStock,
    sort: parsed.sort,
  });
  parsed.contextHash = crypto.createHash("sha256").update(parsed.context).digest("hex");
  if (parsed.cursor !== undefined && (typeof parsed.cursor !== "string" || parsed.cursor.length > 4096)) {
    throw cursorError("Invalid cursor");
  }
  return parsed;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function cursorSecret() {
  return process.env.CURSOR_SECRET || process.env.JWT_SECRET || "product-discovery-development-secret";
}

function signCursor(payload) {
  return crypto.createHmac("sha256", cursorSecret()).update(payload).digest("base64url");
}

function encodeCursor(parsed, row) {
  const definition = SORT_DEFINITIONS[parsed.sort];
  const values = definition.fields.map((field) => {
    const value = row[field];
    if (field === "created_at") return new Date(value).toISOString();
    if (field === "price" || field === "id") return Number(value);
    if (field === "is_featured") return Boolean(value);
    return String(value);
  });
  const payload = base64UrlEncode(JSON.stringify({
    v: CURSOR_VERSION,
    s: parsed.sort,
    c: parsed.contextHash,
    d: values,
  }));
  return `${payload}.${signCursor(payload)}`;
}

function decodeCursor(cursor, parsed) {
  if (typeof cursor !== "string" || cursor.length === 0) throw cursorError("Invalid cursor");
  const parts = cursor.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw cursorError("Invalid cursor");
  const expected = Buffer.from(signCursor(parts[0]));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw cursorError("Invalid cursor");
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(parts[0]));
  } catch (_) {
    throw cursorError("Invalid cursor");
  }

  if (!payload || payload.v !== CURSOR_VERSION || payload.s !== parsed.sort || payload.c !== parsed.contextHash || !Array.isArray(payload.d)) {
    throw cursorError("Cursor does not match the current query");
  }
  const definition = SORT_DEFINITIONS[parsed.sort];
  if (payload.d.length !== definition.fields.length) throw cursorError("Invalid cursor");
  for (let index = 0; index < definition.fields.length; index += 1) {
    const field = definition.fields[index];
    const value = payload.d[index];
    if (field === "created_at" && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) throw cursorError("Invalid cursor");
    if ((field === "price" || field === "id") && (!Number.isFinite(value) || value < 0)) throw cursorError("Invalid cursor");
    if (field === "id" && (!Number.isInteger(value) || value < 1)) throw cursorError("Invalid cursor");
    if (field === "is_featured" && typeof value !== "boolean") throw cursorError("Invalid cursor");
    if (field === "name" && typeof value !== "string") throw cursorError("Invalid cursor");
  }
  return payload.d;
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function appendCursorPredicate(where, values, parsed, cursorValues) {
  if (cursorValues === undefined) return;
  const definition = SORT_DEFINITIONS[parsed.sort];
  const params = cursorValues.map((value, index) => {
    values.push(value);
    const field = definition.fields[index];
    const placeholder = `$${values.length}`;
    /* Without an explicit cast a row comparison resolves the unknown parameter as
       text, and the ISO string sorts lexicographically instead of chronologically. */
    return field === "created_at" ? `${placeholder}::timestamptz` : placeholder;
  });

  /* Every sort definition orders all of its fields in the same direction, so the
     row comparison takes a single operator. Mixing operators here would build
     invalid SQL, because a row constructor is compared as a whole. */
  const directions = new Set(definition.directions);
  if (directions.size > 1) {
    throw new Error(`Sort '${parsed.sort}' mixes sort directions, which row comparison cannot express`);
  }

  const operator = definition.directions[0] === "DESC" ? "<" : ">";
  /* Timestamps are compared at millisecond precision because that is all a cursor can
     carry (a JS Date has no sub-millisecond precision). Without truncating the column
     to match, products sharing a created_at down to the millisecond never fall
     through to the id tiebreaker and the same page repeats forever. */
  const columns = definition.fields
    .map((field) => (field === "created_at" ? `date_trunc('milliseconds', p.${field})` : `p.${field}`))
    .join(", ");

  where.push(`(${columns}) ${operator} (${params.join(", ")})`);
}

function buildQuery(parsed) {
  const values = [];
  const where = ["p.is_active = TRUE"];

  if (parsed.q) {
    for (const term of parsed.q.split(/\s+/).filter(Boolean)) {
      const fieldPredicates = SEARCH_FIELDS.map((field) => {
        values.push(`%${escapeLike(term)}%`);
        return `p.${field} ILIKE $${values.length} ESCAPE '\\'`;
      });
      where.push(`(${fieldPredicates.join(" OR ")})`);
    }
  }

  for (const [name, column] of [["category", "category"], ["brand", "brand"], ["subcategory", "subcategory"]]) {
    if (parsed[name] !== undefined) {
      values.push(parsed[name]);
      where.push(`LOWER(p.${column}) = LOWER($${values.length})`);
    }
  }

  if (parsed.featured !== undefined) {
    values.push(parsed.featured);
    where.push(`p.is_featured = $${values.length}`);
  }
  if (parsed.sale !== undefined) {
    values.push(parsed.sale);
    where.push(`p.offer_sale = $${values.length}`);
  }
  if (parsed.minPrice !== undefined) {
    values.push(parsed.minPrice);
    where.push(`p.price >= $${values.length}`);
  }
  if (parsed.maxPrice !== undefined) {
    values.push(parsed.maxPrice);
    where.push(`p.price <= $${values.length}`);
  }
  if (parsed.inStock !== undefined) {
    where.push(`p.stock_quantity ${parsed.inStock ? ">" : "="} 0`);
  }

  const cursorValues = parsed.cursor === undefined ? undefined : decodeCursor(parsed.cursor, parsed);
  appendCursorPredicate(where, values, parsed, cursorValues);

  values.push(parsed.limit + 1);
  const columns = PRODUCT_COLUMNS.map((column) => `p.${column}`).join(", ");
  const definition = SORT_DEFINITIONS[parsed.sort];
  return {
    text: `SELECT ${columns},
      (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id AND oi.rating IS NOT NULL) AS rating_count,
      (SELECT COALESCE(AVG(oi.rating), 0) FROM order_items oi WHERE oi.product_id = p.id AND oi.rating IS NOT NULL) AS average_rating
      FROM products p
      WHERE ${where.join(" AND ")}
      ORDER BY ${definition.sql}
      LIMIT $${values.length}`,
    values,
  };
}

function mapRows(rows) {
  return rows.map((row) => ({
    ...mapProductToApi(row),
    rating: {
      average: Math.round(Number(row.average_rating || 0) * 10) / 10,
      count: Number(row.rating_count || 0),
    },
  }));
}

async function getProductDiscovery(rawQuery) {
  const parsed = parseQuery(rawQuery);
  const query = buildQuery(parsed);
  const result = await pool.query(query.text, query.values);
  const hasNextPage = result.rows.length > parsed.limit;
  const pageRows = result.rows.slice(0, parsed.limit);
  const products = mapRows(pageRows);
  const nextCursor = hasNextPage ? encodeCursor(parsed, pageRows[pageRows.length - 1]) : null;
  return {
    products,
    pagination: {
      limit: parsed.limit,
      hasNextPage,
      nextCursor,
    },
  };
}

module.exports = {
  getProductDiscovery,
  parseQuery,
  encodeCursor,
  decodeCursor,
  SORT_DEFINITIONS,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
