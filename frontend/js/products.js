import { getProducts } from "./api.js";
import * as cart from "./cart.js";
import { createStarDisplay } from "./stars.js";

const productsGrid = document.getElementById("products-grid");
const loadingEl = document.getElementById("loading");
const emptyEl = document.getElementById("empty-state");
const emptyMessageEl = document.getElementById("empty-state-message");
const errorEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-state-message");
const retryBtn = document.getElementById("retry-btn");
const emptyClearBtn = document.getElementById("empty-clear-btn");
const productCountEl = document.getElementById("product-count");
const discoveryForm = document.getElementById("product-discovery-form");
const searchInput = document.getElementById("product-search");
const clearSearchBtn = document.getElementById("clear-search-btn");
const filterToggleBtn = document.getElementById("filter-toggle-btn");
const discoveryFiltersEl = document.getElementById("discovery-filters");
const categoryFilter = document.getElementById("category-filter");
const brandFilter = document.getElementById("brand-filter");
const subcategoryFilter = document.getElementById("subcategory-filter");
const inStockFilter = document.getElementById("in-stock-filter");
const saleFilter = document.getElementById("sale-filter");
const featuredFilter = document.getElementById("featured-filter");
const minPriceFilter = document.getElementById("min-price-filter");
const maxPriceFilter = document.getElementById("max-price-filter");
const priceFilterError = document.getElementById("price-filter-error");
const sortFilter = document.getElementById("sort-filter");
const activeFiltersEl = document.getElementById("active-filters");
const discoverySummaryEl = document.getElementById("discovery-summary");
const productsContainerEl = document.getElementById("products-container");
const clearAllBtn = document.getElementById("clear-all-btn");
const loadMoreContainer = document.getElementById("load-more-container");
const loadMoreBtn = document.getElementById("load-more-btn");
const loadMoreLabel = document.querySelector(".load-more-label");
const loadMoreStatus = document.getElementById("load-more-status");

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f2f3f6'/%3E%3Ctext x='50%25' y='48%25' dominant-baseline='middle' text-anchor='middle' fill='%23b7bac4' font-size='28' font-family='Arial'%3ENo image%3C/text%3E%3C/svg%3E";

const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_SORT = "id_asc";
const VALID_SORTS = new Set([
  "id_asc",
  "newest",
  "oldest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
  "featured",
]);

const state = {
  query: "",
  category: "",
  brand: "",
  subcategory: "",
  minPrice: "",
  maxPrice: "",
  inStock: false,
  sale: false,
  featured: false,
  sort: DEFAULT_SORT,
  products: [],
  nextCursor: null,
  hasNextPage: false,
  loading: false,
  loadingMore: false,
  searchPending: false,
  hasLoaded: false,
  requestVersion: 0,
  contextSignature: "",
};

let currentProducts = [];
let searchDebounceTimer = null;
let activeRequestController = null;

function setBusy(isBusy) {
  productsContainerEl?.setAttribute("aria-busy", String(isBusy));
  productsContainerEl?.classList.toggle("is-updating", isBusy);
}

function endBusy() {
  setBusy(false);
}

/* A result replacement keeps the current grid on screen so a small filter change
   does not flash a blank page. Only the first load shows the full panel. */
function showLoading() {
  const keepResults = state.hasLoaded && state.products.length > 0;

  state.loading = true;
  loadingEl.style.display = keepResults ? "none" : "flex";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = keepResults ? "grid" : "none";
  loadMoreContainer.style.display = keepResults ? loadMoreContainer.style.display : "none";

  if (keepResults) {
    setBusy(true);
    updateProductCount("Updating results...");
  } else {
    setBusy(false);
    updateProductCount("Loading products...");
  }
}

function showError(message = "We couldn't connect to the store right now. Please try again.") {
  state.loading = false;
  state.hasLoaded = true;
  endBusy();
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "flex";
  productsGrid.style.display = "none";
  loadMoreContainer.style.display = "none";
  errorMessageEl.textContent = message;
  updateProductCount("Products unavailable");
  renderDiscoverySummary();
}

function showEmpty() {
  state.loading = false;
  state.hasLoaded = true;
  endBusy();
  loadingEl.style.display = "none";
  emptyEl.style.display = "flex";
  errorEl.style.display = "none";
  productsGrid.style.display = "none";
  loadMoreContainer.style.display = "none";
  emptyMessageEl.textContent = getEmptyMessage();
  updateProductCount("0 products");
  renderDiscoverySummary();
}

function showProducts(products) {
  state.loading = false;
  state.hasLoaded = true;
  endBusy();
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = "grid";
  loadMoreContainer.style.display = state.hasNextPage ? "flex" : "none";
  updateLoadedProductCount();
  renderDiscoverySummary();
  renderProducts(products);
}

function updateProductCount(text) {
  const textElement = productCountEl?.querySelector("span");
  if (textElement) {
    textElement.textContent = text;
  }
}

function updateLoadedProductCount() {
  const noun = state.products.length === 1 ? "product" : "products";
  updateProductCount(
    state.hasNextPage
      ? `Showing ${state.products.length} ${noun}`
      : `${state.products.length} ${noun}`
  );
}

/* =========================================================
   PRODUCT RENDERING
   ========================================================= */

function renderProducts(products) {
  productsGrid.replaceChildren();
  appendProductCards(products);
}

/* Load More appends only the new cards. The grid is not rebuilt, so scroll position
   and the already-rendered cards survive. */
function appendProductCards(products) {
  if (!products.length) return;

  const fragment = document.createDocumentFragment();

  products.forEach((product) => {
    fragment.appendChild(createProductCard(product));
  });

  productsGrid.appendChild(fragment);
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const productId = Number(product.id);
  const stock = Number(product.stock_quantity);
  const hasStock = Number.isFinite(stock) && stock > 0;

  /* ---------- Image ---------- */
  const imageLink = document.createElement("a");
  imageLink.className = "product-card-image-link";
  imageLink.href = `product-details.html?id=${encodeURIComponent(productId)}`;
  imageLink.setAttribute(
    "aria-label",
    `View details for ${product.name || "product"}`
  );

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "product-card-image";

  const img = document.createElement("img");
  img.src = product.image_url || FALLBACK_IMAGE;
  img.alt = product.name || "Product image";
  img.loading = "lazy";
  img.decoding = "async";
  img.addEventListener("error", () => {
    if (img.src !== FALLBACK_IMAGE) {
      img.src = FALLBACK_IMAGE;
    }
  });
  imageWrapper.appendChild(img);

  const badge = document.createElement("span");
  badge.className = `product-badge ${hasStock ? "" : "out-of-stock"}`;
  badge.innerHTML = hasStock
    ? `<i class="ri-checkbox-circle-line" aria-hidden="true"></i> In stock`
    : `<i class="ri-close-circle-line" aria-hidden="true"></i> Out of stock`;

  const isSale =
    Boolean(product.offer_sale) && product.offer_price != null;
  const hasDiscount =
    isSale &&
    product.regular_price != null &&
    Number(product.regular_price) > 0 &&
    Number(product.regular_price) > Number(product.price);

  // if (hasDiscount) {
  //   const saleBadge = document.createElement("span");
  //   saleBadge.className = "product-sale-badge";
  //   saleBadge.textContent = "Sale";
  //   imageLink.appendChild(saleBadge);
  // }

  imageLink.appendChild(imageWrapper);
  imageLink.appendChild(badge);

  /* ---------- Body ---------- */
  const body = document.createElement("div");
  body.className = "product-card-body";

  const category = document.createElement("span");
  category.className = "product-category";
  category.textContent = product.category || product.subcategory || "Product";

  const name = document.createElement("h2");
  name.className = "product-name";
  name.textContent = product.name || "Unnamed product";
  name.title = product.name || "Unnamed product";

  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent =
    product.short_description || product.description || "Discover this product in our collection.";

  body.appendChild(category);
  body.appendChild(name);
  body.appendChild(description);

  /* ---------- Rating ---------- */
  const ratingWrapper = document.createElement("div");
  ratingWrapper.className = "product-rating";

  if (product.rating) {
    const average = Number(product.rating.average || 0);
    const count = Number(product.rating.count || 0);

    const starsWrapper = document.createElement("span");
    starsWrapper.className = "product-rating-stars";

    const stars = createStarDisplay(average);
    starsWrapper.appendChild(stars);
    ratingWrapper.appendChild(starsWrapper);

    if (count > 0) {
      const averageText = document.createElement("span");
      averageText.className = "product-rating-value";
      averageText.textContent = average.toFixed(1);

      const countText = document.createElement("span");
      countText.className = "product-rating-count";
      countText.textContent = `(${count})`;

      ratingWrapper.appendChild(averageText);
      ratingWrapper.appendChild(countText);
    }
  } else {
    const noRating = document.createElement("span");
    noRating.className = "product-rating-count";
    noRating.textContent = "No ratings yet";
    ratingWrapper.appendChild(noRating);
  }

  body.appendChild(ratingWrapper);

  /* ---------- Bottom ---------- */
  const bottom = document.createElement("div");
  bottom.className = "product-card-bottom";

  const pricing = document.createElement("div");
  pricing.className = "product-pricing";

  const price = document.createElement("p");
  price.className = "product-price";
  price.textContent = formatPrice(product.price);

  const stockText = document.createElement("p");
  stockText.className = `product-stock ${hasStock ? "" : "out-of-stock"}`;
  stockText.textContent = hasStock
    ? `${stock} available`
    : "Currently unavailable";

  if (hasDiscount) {
    const regularPrice = document.createElement("span");
    regularPrice.className = "product-regular-price";
    regularPrice.textContent = formatPrice(product.regular_price);

    const discount = Math.round(
      ((Number(product.regular_price) - Number(product.price)) /
        Number(product.regular_price)) *
        100
    );

    const discountBadge = document.createElement("span");
    discountBadge.className = "product-sale-badge";
    discountBadge.textContent = `-${discount}%`;

    pricing.appendChild(regularPrice);
    pricing.appendChild(price);
    imageLink.appendChild(discountBadge);
  } else {
    pricing.appendChild(price);
  }

  // pricing.appendChild(stockText);

  const actions = document.createElement("div");
  actions.className = "product-actions";

  const viewLink = document.createElement("a");
  viewLink.className = "product-view-button";
  viewLink.href = `product-details.html?id=${encodeURIComponent(productId)}`;
  viewLink.innerHTML = `
    View <i class="ri-arrow-right-line" aria-hidden="true"></i>
  `;

  const addButton = document.createElement("button");
  addButton.className = "product-add-button";
  addButton.type = "button";
  addButton.dataset.productId = String(productId);
  addButton.disabled = !hasStock;
  addButton.setAttribute(
    "aria-label",
    hasStock
      ? `Add ${product.name || "product"} to cart`
      : `${product.name || "Product"} is out of stock`
  );
  addButton.title = hasStock ? "Add to cart" : "Out of stock";
  addButton.innerHTML = hasStock
    ? '<i class="ri-shopping-bag-line" aria-hidden="true"></i>'
    : '<i class="ri-close-line" aria-hidden="true"></i>';

  actions.appendChild(viewLink);
  actions.appendChild(addButton);

  bottom.appendChild(pricing);
  bottom.appendChild(actions);

  body.appendChild(bottom);

  card.appendChild(imageLink);
  card.appendChild(body);

  return card;
}

/* =========================================================
   CART
   ========================================================= */

/* One delegated listener for the whole grid, registered once. Re-rendering the grid
   therefore cannot stack duplicate handlers on the add-to-cart buttons. */
function handleGridClick(event) {
  const button = event.target.closest(".product-add-button");

  if (!button || button.disabled || !productsGrid.contains(button)) {
    return;
  }

  const productId = Number(button.dataset.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return;
  }

  const product = currentProducts.find((item) => Number(item.id) === productId);

  if (!product) return;

  handleAddToCart(product, button);
}

function handleAddToCart(product, button) {
  const stock = Number(product.stock_quantity);

  if (!Number.isInteger(stock) || stock <= 0) {
    return;
  }

  const existingQuantity = cart.getQuantity(product.id);

  if (existingQuantity >= stock) {
    showCartLimitFeedback(button, stock);
    return;
  }

  try {
    cart.addToCart(product.id, 1);

    const originalIcon = button.innerHTML;
    const originalLabel = button.getAttribute("aria-label");

    button.innerHTML = '<i class="ri-check-line" aria-hidden="true"></i>';
    button.setAttribute("aria-label", "Added to cart");
    button.title = "Added to cart";

    window.setTimeout(() => {
      button.innerHTML = originalIcon;
      button.setAttribute("aria-label", originalLabel);
      button.title = "Add to cart";
    }, 1200);

    updateGlobalCartCount();
  } catch (error) {
    console.error("Failed to add product to cart:", error);
  }
}

function showCartLimitFeedback(button, stock) {
  const originalTitle = button.title;
  const originalIcon = button.innerHTML;

  button.innerHTML = '<i class="ri-information-line" aria-hidden="true"></i>';
  button.title = `Only ${stock} available`;

  window.setTimeout(() => {
    button.innerHTML = originalIcon;
    button.title = originalTitle;
  }, 1400);
}

function updateGlobalCartCount() {
  const countElement = document.getElementById("cart-count");

  if (countElement) {
    countElement.textContent = String(cart.getCartItemCount());
  }
}

/* =========================================================
   FORMATTING
   ========================================================= */

function formatPrice(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function hasActiveFilters() {
  return Boolean(
    state.category ||
      state.brand ||
      state.subcategory ||
      state.minPrice !== "" ||
      state.maxPrice !== "" ||
      state.inStock ||
      state.sale ||
      state.featured
  );
}

function hasActiveDiscovery() {
  return Boolean(state.query) || hasActiveFilters() || state.sort !== DEFAULT_SORT;
}

function readPrice(value) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? String(number) : "";
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get("sort");

  state.query = params.get("q") || "";
  state.category = params.get("category") || "";
  state.brand = params.get("brand") || "";
  state.subcategory = params.get("subcategory") || "";
  state.minPrice = readPrice(params.get("min_price") || "");
  state.maxPrice = readPrice(params.get("max_price") || "");
  state.inStock = params.get("in_stock") === "true";
  state.sale = params.get("sale") === "true";
  state.featured = params.get("featured") === "true";
  state.sort = VALID_SORTS.has(sort) ? sort : DEFAULT_SORT;
}

/* A <select> silently drops a value it does not contain, which would make a shared
   URL such as ?brand=old-brand disagree with the control and then vanish on the next
   change. Keep the value visible instead of substituting a different one. */
function setSelectValue(select, value) {
  if (!value) {
    select.value = "";
    return;
  }

  const exists = Array.from(select.options || []).some(
    (option) => option.value === value
  );

  if (!exists) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${value} (unavailable)`;
    option.dataset.unavailable = "true";
    select.appendChild(option);
  }

  select.value = value;
}

function getSearchContextSignature() {
  return [
    state.query,
    state.category,
    state.brand,
    state.subcategory,
    state.minPrice,
    state.maxPrice,
    state.inStock,
    state.sale,
    state.featured,
    state.sort,
  ].join("|");
}

function syncControlsFromState() {
  searchInput.value = state.query;
  setSelectValue(categoryFilter, state.category);
  setSelectValue(brandFilter, state.brand);
  setSelectValue(subcategoryFilter, state.subcategory);
  inStockFilter.checked = state.inStock;
  saleFilter.checked = state.sale;
  featuredFilter.checked = state.featured;
  minPriceFilter.value = state.minPrice;
  maxPriceFilter.value = state.maxPrice;
  sortFilter.value = state.sort;
  clearSearchBtn.hidden = state.query.length === 0;
  priceFilterError.hidden = true;
  priceFilterError.textContent = "";
  renderActiveFilters();
  renderDiscoverySummary();
}

function buildApiParams(cursor = null) {
  const params = {
    limit: 20,
  };

  if (state.query.trim()) params.q = state.query.trim();
  if (state.category) params.category = state.category;
  if (state.brand) params.brand = state.brand;
  if (state.subcategory) params.subcategory = state.subcategory;
  if (state.minPrice !== "") params.min_price = state.minPrice;
  if (state.maxPrice !== "") params.max_price = state.maxPrice;
  if (state.inStock) params.in_stock = "true";
  if (state.sale) params.sale = "true";
  if (state.featured) params.featured = "true";
  if (state.sort !== DEFAULT_SORT) params.sort = state.sort;
  if (cursor) params.cursor = cursor;
  return params;
}

const URL_PARAM_ORDER = [
  "q",
  "category",
  "brand",
  "subcategory",
  "min_price",
  "max_price",
  "in_stock",
  "sale",
  "featured",
  "sort",
];

function buildDiscoveryUrl() {
  const url = new URL(window.location.href);

  /* Drop every discovery parameter, including ones the page does not support
     (limit, cursor, hand-edited junk), so the address bar always holds exactly the
     current intent in a fixed order. */
  [...url.searchParams.keys()].forEach((key) => url.searchParams.delete(key));

  const params = buildApiParams();
  delete params.limit;

  URL_PARAM_ORDER.forEach((key) => {
    const value = params[key];
    if (value !== "" && value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  return `${url.pathname}${url.search}${url.hash}`;
}

function currentLocationString() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/* Returns false when the state already matches the address bar, so a no-op change
   does not add a dead history entry. */
function updateUrl(push = true) {
  const nextUrl = buildDiscoveryUrl();

  if (nextUrl === currentLocationString()) {
    return false;
  }

  if (push) {
    window.history.pushState({}, "", nextUrl);
  } else {
    window.history.replaceState({}, "", nextUrl);
  }

  return true;
}

/* Strips invalid or unknown parameters from the address bar without adding history. */
function canonicalizeUrl() {
  return updateUrl(false);
}

function validatePriceRange() {
  const min = minPriceFilter.value;
  const max = maxPriceFilter.value;
  const minNumber = min === "" ? 0 : Number(min);
  const maxNumber = max === "" ? null : Number(max);
  let error = "";

  if (min !== "" && (!Number.isFinite(minNumber) || minNumber < 0)) {
    error = "Minimum price must be zero or greater.";
  } else if (max !== "" && (!Number.isFinite(maxNumber) || maxNumber < 0)) {
    error = "Maximum price must be zero or greater.";
  } else if (minNumber > maxNumber) {
    error = "Minimum price must not exceed maximum price.";
  }

  priceFilterError.textContent = error;
  priceFilterError.hidden = !error;
  return !error;
}

function readControlsIntoState() {
  if (!validatePriceRange()) return false;

  state.category = categoryFilter.value;
  state.brand = brandFilter.value;
  state.subcategory = subcategoryFilter.value;
  state.minPrice = readPrice(minPriceFilter.value);
  state.maxPrice = readPrice(maxPriceFilter.value);
  state.inStock = inStockFilter.checked;
  state.sale = saleFilter.checked;
  state.featured = featuredFilter.checked;
  state.sort = VALID_SORTS.has(sortFilter.value) ? sortFilter.value : DEFAULT_SORT;
  return true;
}

/* Invalidates the cursor and the paging UI, but deliberately keeps the rendered
   products so a replacement fetch can swap content without a blank flash. */
function resetProductsForDiscovery() {
  state.nextCursor = null;
  state.hasNextPage = false;
  state.loadingMore = false;
  loadMoreBtn.disabled = state.searchPending;
  loadMoreLabel.textContent = "Load more products";
  loadMoreStatus.textContent = "";
  loadMoreContainer.style.display = "none";
}

async function commitDiscoveryChange() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = null;
  state.searchPending = false;
  loadMoreBtn.disabled = false;

  state.query = searchInput.value.trim();
  searchInput.value = state.query;
  clearSearchBtn.hidden = state.query.length === 0;

  if (!readControlsIntoState()) return;

  resetProductsForDiscovery();
  renderActiveFilters();
  renderDiscoverySummary();
  updateUrl(true);
  await loadProducts();
}

function getEmptyMessage() {
  if (state.query) {
    return `No products match “${state.query}”. Try a different search or clear your filters.`;
  }
  if (hasActiveFilters()) {
    return "No products match the selected filters. Try widening them.";
  }
  if (state.sort !== DEFAULT_SORT) {
    return "No products are available in this collection right now.";
  }
  return "There are no products available right now.";
}

function getFilterSummaryParts() {
  const parts = [];

  if (state.category) parts.push(state.category);
  if (state.brand) parts.push(state.brand);
  if (state.subcategory) parts.push(state.subcategory);
  if (state.minPrice !== "" || state.maxPrice !== "") {
    const min = state.minPrice === "" ? formatPrice(0) : formatPrice(state.minPrice);
    const max = state.maxPrice === "" ? "any" : formatPrice(state.maxPrice);
    parts.push(`Price ${min}–${max}`);
  }
  if (state.inStock) parts.push("In stock");
  if (state.sale) parts.push("On sale");
  if (state.featured) parts.push("Featured");
  if (state.sort !== DEFAULT_SORT) parts.push(`Sorted by ${sortLabel(state.sort)}`);

  return parts;
}

function renderDiscoverySummary() {
  if (!discoverySummaryEl) return;

  const parts = getFilterSummaryParts();
  let text = "All products";

  if (state.query) {
    text = `Results for “${state.query}”`;
  } else if (parts.length) {
    text = "Filtered results";
  }

  if (state.query && parts.length) {
    text = `${text} · ${parts.join(" · ")}`;
  } else if (!state.query && parts.length) {
    text = parts.join(" · ");
  }

  discoverySummaryEl.textContent = text;
}

function sortLabel(value) {
  const options = Array.from(sortFilter.options || []);
  const selected = options.find((option) => option.value === value);
  return selected ? selected.textContent : value;
}

function getActiveFilterDescriptors() {
  return [
    { key: "query", value: state.query, label: `Search: ${state.query}` },
    { key: "category", value: state.category, label: `Category: ${state.category}` },
    { key: "brand", value: state.brand, label: `Brand: ${state.brand}` },
    { key: "subcategory", value: state.subcategory, label: `Subcategory: ${state.subcategory}` },
    {
      key: "minPrice",
      value: state.minPrice,
      label: state.minPrice === "" ? "" : `Min price: ${formatPrice(state.minPrice)}`,
    },
    {
      key: "maxPrice",
      value: state.maxPrice,
      label: state.maxPrice === "" ? "" : `Max price: ${formatPrice(state.maxPrice)}`,
    },
    { key: "inStock", value: state.inStock ? "true" : "", label: "In stock" },
    { key: "sale", value: state.sale ? "true" : "", label: "On sale" },
    { key: "featured", value: state.featured ? "true" : "", label: "Featured" },
    {
      key: "sort",
      value: state.sort !== DEFAULT_SORT ? state.sort : "",
      label: state.sort === DEFAULT_SORT ? "" : `Sort: ${sortLabel(state.sort)}`,
    },
  ];
}

function renderActiveFilters() {
  activeFiltersEl.replaceChildren();
  clearAllBtn.hidden = !hasActiveDiscovery();

  getActiveFilterDescriptors()
    .filter(({ value }) => value !== "")
    .forEach(({ key, label }) => {
      const chip = document.createElement("span");
      chip.className = "filter-chip";

      const text = document.createElement("span");
      text.textContent = label;
      chip.appendChild(text);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${label} filter`);
      remove.innerHTML = '<i class="ri-close-line" aria-hidden="true"></i>';
      remove.addEventListener("click", () => removeFilter(key));
      chip.appendChild(remove);
      activeFiltersEl.appendChild(chip);
    });
}

function removeFilter(key) {
  if (key === "query") {
    state.query = "";
    searchInput.value = "";
  } else if (key === "inStock" || key === "sale" || key === "featured" || key === "sort") {
    state[key] = key === "sort" ? DEFAULT_SORT : false;
  } else {
    state[key] = "";
  }
  syncControlsFromState();
  commitDiscoveryChange();
}

function resetControls() {
  state.query = "";
  state.category = "";
  state.brand = "";
  state.subcategory = "";
  state.minPrice = "";
  state.maxPrice = "";
  state.inStock = false;
  state.sale = false;
  state.featured = false;
  state.sort = DEFAULT_SORT;
  syncControlsFromState();
}

function appendUniqueProducts(incoming) {
  const existingIds = new Set(state.products.map((product) => Number(product.id)));
  const unique = incoming.filter((product) => {
    const id = Number(product.id);
    if (!Number.isInteger(id) || existingIds.has(id)) {
      if (Number.isInteger(id)) {
        console.warn("Duplicate product returned by discovery pagination", id);
      }
      return false;
    }
    existingIds.add(id);
    return true;
  });
  state.products = [...state.products, ...unique];
  currentProducts = state.products;
  return unique.length;
}

function getUserFacingError(error) {
  const status = Number(error?.status);

  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return error?.message || "We couldn't run that search. Please try again.";
  }

  return "We couldn't connect to the store right now. Please try again.";
}

async function loadProducts() {
  const version = state.requestVersion + 1;
  const context = getSearchContextSignature();

  state.requestVersion = version;
  state.contextSignature = context;
  activeRequestController?.abort();
  activeRequestController = new AbortController();
  showLoading();

  try {
    const result = await getProducts(buildApiParams(), {
      signal: activeRequestController.signal,
    });

    if (version !== state.requestVersion || context !== state.contextSignature) return;
    if (!result || !result.success) {
      throw new Error("Unable to load products");
    }

    const products = Array.isArray(result.data) ? result.data : [];
    state.products = products;
    currentProducts = products;
    state.nextCursor = result.pagination?.nextCursor || null;
    state.hasNextPage = Boolean(result.pagination?.hasNextPage && state.nextCursor);

    if (products.length === 0) {
      showEmpty();
      return;
    }
    showProducts(products);
  } catch (error) {
    if (error?.name === "AbortError" || version !== state.requestVersion) return;
    showError(getUserFacingError(error));
  }
}

async function loadMoreProducts() {
  /* A pending debounce means the committed state is newer than the visible results,
     so the cursor in hand does not belong to it yet. */
  if (
    !state.hasNextPage ||
    !state.nextCursor ||
    state.loadingMore ||
    state.searchPending
  ) {
    return;
  }

  const version = state.requestVersion;
  const context = state.contextSignature;
  const cursor = state.nextCursor;
  const controller = new AbortController();

  state.loadingMore = true;
  loadMoreBtn.disabled = true;
  loadMoreLabel.textContent = "Loading products...";
  loadMoreStatus.textContent = "Loading more products";

  try {
    const result = await getProducts(buildApiParams(cursor), {
      signal: controller.signal,
    });

    if (version !== state.requestVersion || context !== state.contextSignature) return;
    if (!result || !result.success) throw new Error("Unable to load more products");

    const products = Array.isArray(result.data) ? result.data : [];
    const added = appendUniqueProducts(products);
    state.nextCursor = result.pagination?.nextCursor || null;
    state.hasNextPage = Boolean(result.pagination?.hasNextPage && state.nextCursor);
    appendProductCards(products.slice(0, added));
    updateLoadedProductCount();
    loadMoreContainer.style.display = state.hasNextPage ? "flex" : "none";
  } catch (error) {
    if (error?.name !== "AbortError" && version === state.requestVersion) {
      showError(getUserFacingError(error));
    }
  } finally {
    if (version === state.requestVersion) {
      state.loadingMore = false;
      loadMoreBtn.disabled = state.searchPending;
      loadMoreLabel.textContent = "Load more products";
      loadMoreStatus.textContent = "";
    }
  }
}

/* Re-reads the address bar, restores every control, discards the cursor and refetches
   page one. Used on first load and on Back/Forward. */
function loadFromUrl() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = null;
  state.searchPending = false;
  readUrlState();
  syncControlsFromState();
  canonicalizeUrl();
  resetProductsForDiscovery();
  return loadProducts();
}

searchInput.addEventListener("input", () => {
  /* Only the draft changes here. state.query stays committed until the debounce
     fires, so Load More can never pair a new term with an old cursor. */
  clearSearchBtn.hidden = searchInput.value.length === 0;
  clearTimeout(searchDebounceTimer);
  state.searchPending = true;
  loadMoreBtn.disabled = true;
  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = null;
    state.searchPending = false;
    commitDiscoveryChange();
  }, SEARCH_DEBOUNCE_MS);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && searchInput.value !== "") {
    event.preventDefault();
    clearSearchInput();
  }
});

discoveryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  commitDiscoveryChange();
});

function clearSearchInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = null;
  state.searchPending = false;
  searchInput.value = "";
  clearSearchBtn.hidden = true;
  commitDiscoveryChange();
}

clearSearchBtn.addEventListener("click", clearSearchInput);

[categoryFilter, brandFilter, subcategoryFilter, sortFilter, inStockFilter, saleFilter, featuredFilter, minPriceFilter, maxPriceFilter].forEach((control) => {
  control.addEventListener("change", () => {
    commitDiscoveryChange();
  });
});

clearAllBtn.addEventListener("click", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = null;
  resetControls();
  commitDiscoveryChange();
});

emptyClearBtn.addEventListener("click", () => {
  clearAllBtn.click();
});

filterToggleBtn.addEventListener("click", () => {
  const isOpen = discoveryFiltersEl.classList.toggle("is-open");
  filterToggleBtn.setAttribute("aria-expanded", String(isOpen));
});

loadMoreBtn.addEventListener("click", loadMoreProducts);
retryBtn.addEventListener("click", loadProducts);
productsGrid.addEventListener("click", handleGridClick);
window.addEventListener("popstate", loadFromUrl);

if (window.matchMedia("(max-width: 820px)").matches) {
  discoveryFiltersEl.classList.remove("is-open");
  filterToggleBtn.setAttribute("aria-expanded", "false");
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromUrl();
  updateGlobalCartCount();
});
