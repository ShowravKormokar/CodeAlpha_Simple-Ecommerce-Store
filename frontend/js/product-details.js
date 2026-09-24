import { getProductById } from "./api.js";
import * as cart from "./cart.js";
import { createStarDisplay } from "./stars.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const notFoundEl = document.getElementById("not-found-state");
const invalidEl = document.getElementById("invalid-state");
const detailsEl = document.getElementById("product-details");
const detailImage = document.getElementById("detail-image");
const detailImageFallback = document.getElementById("product-image-fallback");
const detailName = document.getElementById("detail-name");
const detailCategory = document.getElementById("detail-category");
const detailBrand = document.getElementById("detail-brand");
const detailPrice = document.getElementById("detail-price");
const detailPriceContainer = document.getElementById("detail-price-container");
const detailDescription = document.getElementById("detail-description");
const detailStock = document.getElementById("detail-stock");
const detailStockBadge = document.getElementById("detail-stock-badge");
const detailSaleBadge = document.getElementById("detail-sale-badge");
const detailVariantGroup = document.getElementById("detail-variant-group");
const detailVariant = document.getElementById("detail-variant");
const detailColorGroup = document.getElementById("detail-color-group");
const colorOptions = document.getElementById("color-options");
const detailSizeGroup = document.getElementById("detail-size-group");
const sizeOptions = document.getElementById("size-options");
const productOptions = document.getElementById("product-options");
const specificationsSection = document.getElementById("specifications-section");
const specificationsContent = document.getElementById("specifications-content");
const productAttributes = document.getElementById("product-attributes");
const attributesGrid = document.getElementById("attributes-grid");
const productRatingEl = document.getElementById("product-rating");
const qtyDec = document.getElementById("qty-dec");
const qtyInput = document.getElementById("qty-input");
const qtyInc = document.getElementById("qty-inc");
const addToCartBtn = document.getElementById("add-to-cart");
const quantityHint = document.getElementById("quantity-hint");

let currentProduct = null;

/* =========================================================
   CONSTANTS
   ========================================================= */

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'%3E%3Crect width='800' height='800' fill='%23f2f3f6'/%3E%3Ctext x='50%25' y='47%25' dominant-baseline='middle' text-anchor='middle' fill='%23b7bac4' font-size='34' font-family='Arial'%3ENo image available%3C/text%3E%3C/svg%3E";

/* =========================================================
   PAGE STATES
   ========================================================= */

function showLoading() {
  loadingEl.style.display = "flex";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showError() {
  loadingEl.style.display = "none";
  errorEl.style.display = "flex";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showNotFound() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "flex";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showInvalid() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "flex";
  detailsEl.style.display = "none";
}

function showDetails() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "grid";
}

/* =========================================================
   PRODUCT DISPLAY
   ========================================================= */

function renderProduct(product) {
  currentProduct = product;

  detailName.textContent = product.name || "Unnamed product";
  detailCategory.textContent = product.category
    ? product.category.toUpperCase()
    : "PRODUCT";
  detailDescription.textContent =
    product.short_description || product.description || "Discover this product from our collection.";

  renderBrand(product.brand);
  renderOfferPricing(product);
  renderStock(getStock(product));
  renderProductImage(product);
  renderProductRating(product.rating);
  renderOptions(product);
  renderSpecifications(product.specifications);
  renderAttributes(product);
  configureQuantity(getStock(product));

  showDetails();
}

function renderBrand(brand) {
  if (brand) {
    detailBrand.textContent = brand;
    detailBrand.style.display = "block";
  } else {
    detailBrand.style.display = "none";
  }
}

function renderOfferPricing(product) {
  const isSale =
    Boolean(product.offer_sale) && product.offer_price != null;

  const hasDiscount =
    isSale &&
    product.regular_price != null &&
    Number(product.regular_price) > 0 &&
    Number(product.regular_price) > Number(product.price);

  detailPriceContainer.innerHTML = "";

  if (hasDiscount) {
    const currentPrice = document.createElement("p");
    currentPrice.className = "detail-price";
    currentPrice.textContent = formatPrice(product.price);

    const regularPrice = document.createElement("p");
    regularPrice.className = "detail-regular-price";
    regularPrice.textContent = formatPrice(product.regular_price);

    const discount = Math.round(
      ((Number(product.regular_price) - Number(product.price)) /
        Number(product.regular_price)) *
        100
    );

    const discountBadge = document.createElement("span");
    discountBadge.className = "detail-discount-badge";
    discountBadge.innerHTML = `
      <i class="ri-arrow-down-circle-line" aria-hidden="true"></i>
      ${discount}% OFF
    `;

    detailPriceContainer.appendChild(currentPrice);
    detailPriceContainer.appendChild(regularPrice);
    detailPriceContainer.appendChild(discountBadge);

    detailPriceContainer.classList.add("has-discount");
  } else {
    const currentPrice = document.createElement("p");
    currentPrice.id = "detail-price";
    currentPrice.className = "detail-price";
    currentPrice.textContent = formatPrice(product.price);

    detailPriceContainer.appendChild(currentPrice);
    detailPriceContainer.classList.remove("has-discount");
  }
}

function renderOptions(product) {
  const hasVariant = product.variant;
  const hasColors = Array.isArray(product.colors) && product.colors.length > 0;
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;

  if (!hasVariant && !hasColors && !hasSizes) {
    productOptions.style.display = "none";
    return;
  }

  productOptions.style.display = "flex";

  if (hasVariant) {
    detailVariantGroup.style.display = "block";
    detailVariant.textContent = product.variant;
  } else {
    detailVariantGroup.style.display = "none";
  }

  if (hasColors) {
    detailColorGroup.style.display = "block";
    colorOptions.innerHTML = "";
    product.colors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      swatch.textContent = color;
      swatch.setAttribute("aria-label", `Color: ${color}`);
      if (color.toLowerCase().includes("black")) {
        swatch.classList.add("color-black");
      } else if (color.toLowerCase().includes("white")) {
        swatch.classList.add("color-white");
      } else if (color.toLowerCase().includes("blue")) {
        swatch.classList.add("color-blue");
      } else if (color.toLowerCase().includes("red")) {
        swatch.classList.add("color-red");
      } else if (color.toLowerCase().includes("silver")) {
        swatch.classList.add("color-silver");
      }
      swatch.addEventListener("click", () => {
        colorOptions
          .querySelectorAll(".color-swatch")
          .forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
      });
      colorOptions.appendChild(swatch);
    });
  } else {
    detailColorGroup.style.display = "none";
  }

  if (hasSizes) {
    detailSizeGroup.style.display = "block";
    sizeOptions.innerHTML = "";
    product.sizes.forEach((size) => {
      const label = document.createElement("label");
      label.className = "size-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "size";
      input.value = size;
      input.setAttribute("aria-label", `Size: ${size}`);
      const span = document.createElement("span");
      span.textContent = size;
      label.appendChild(input);
      label.appendChild(span);
      sizeOptions.appendChild(label);
    });
  } else {
    detailSizeGroup.style.display = "none";
  }
}

function renderSpecifications(specifications) {
  const specs =
    specifications && typeof specifications === "object" && !Array.isArray(specifications)
      ? specifications
      : {};

  const keys = Object.keys(specs);
  if (keys.length === 0) {
    specificationsSection.style.display = "none";
    return;
  }

  specificationsSection.style.display = "block";
  specificationsContent.innerHTML = "";

  const table = document.createElement("table");
  table.className = "specifications-table";

  keys.forEach((key) => {
    const tr = document.createElement("tr");

    const labelCell = document.createElement("th");
    labelCell.scope = "row";
    labelCell.textContent = key;

    const valueCell = document.createElement("td");
    valueCell.textContent = String(specs[key] ?? "");

    tr.appendChild(labelCell);
    tr.appendChild(valueCell);
    table.appendChild(tr);
  });

  specificationsContent.appendChild(table);
}

function renderAttributes(product) {
  const attributes = [];

  if (product.brand) attributes.push(["Brand", product.brand]);
  if (product.vendor) attributes.push(["Vendor", product.vendor]);
  if (product.made_in) attributes.push(["Made In", product.made_in]);
  if (product.material) attributes.push(["Material", product.material]);
  if (product.warranty) attributes.push(["Warranty", product.warranty]);
  if (product.weight != null) attributes.push(["Weight", `${product.weight} kg`]);
  if (product.unit) attributes.push(["Unit", product.unit]);
  if (product.barcode) attributes.push(["Barcode", product.barcode]);
  if (product.sku) attributes.push(["SKU", product.sku]);

  const hasTags = Array.isArray(product.tags) && product.tags.length > 0;
  if (hasTags) {
    attributes.push(["Tags", product.tags.join(", ")]);
  }

  if (attributes.length === 0) {
    productAttributes.style.display = "none";
    return;
  }

  productAttributes.style.display = "block";
  attributesGrid.innerHTML = "";

  attributes.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "attribute-row";

    const labelEl = document.createElement("span");
    labelEl.className = "attribute-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "attribute-value";
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    attributesGrid.appendChild(row);
  });
}

function getStock(product) {
  const stock = Number(product.stock_quantity);
  if (!Number.isFinite(stock) || stock < 0) {
    return 0;
  }
  return Math.floor(stock);
}

/* =========================================================
   IMAGE
   ========================================================= */

function renderProductImage(product) {
  detailImageFallback.classList.remove("visible");
  detailImage.alt = product.name || "Product image";

  const isSale =
    Boolean(product.offer_sale) && product.offer_price != null;
  const hasDiscount =
    isSale &&
    product.regular_price != null &&
    Number(product.regular_price) > 0 &&
    Number(product.regular_price) > Number(product.price);

  detailSaleBadge.style.display = hasDiscount ? "inline-flex" : "none";

  const imageUrl = product.image_url?.trim();
  if (!imageUrl) {
    showImageFallback();
    return;
  }

  detailImage.src = imageUrl;

  detailImage.onload = () => {
    detailImage.style.display = "block";
    detailImageFallback.classList.remove("visible");
  };

  detailImage.onerror = () => {
    detailImage.src = FALLBACK_IMAGE;
    detailImage.style.display = "block";
    detailImageFallback.classList.remove("visible");
  };
}

function showImageFallback() {
  detailImage.src = FALLBACK_IMAGE;
  detailImage.style.display = "block";
  detailImageFallback.classList.remove("visible");
}

/* =========================================================
   STOCK
   ========================================================= */

function renderStock(stock) {
  const inStock = stock > 0;

  detailStock.textContent = inStock
    ? `${stock} ${stock === 1 ? "unit" : "units"} available`
    : "Currently out of stock";

  detailStock.className = `detail-stock ${inStock ? "in-stock" : "out-of-stock"
    }`;

  detailStockBadge.className = `detail-stock-badge ${inStock ? "" : "out-of-stock"
    }`;

  detailStockBadge.innerHTML = inStock
    ? '<i class="ri-checkbox-circle-line" aria-hidden="true"></i> In stock'
    : '<i class="ri-close-circle-line" aria-hidden="true"></i> Out of stock';
}

/* =========================================================
   RATING
   ========================================================= */

function renderProductRating(ratingSummary) {
  productRatingEl.innerHTML = "";

  if (!ratingSummary) {
    productRatingEl.style.display = "flex";

    const noRatings = document.createElement("span");
    noRatings.className = "no-ratings";
    noRatings.textContent = "No ratings yet";
    productRatingEl.appendChild(noRatings);
    return;
  }

  const average = Number(ratingSummary.average || 0);
  const count = Number(ratingSummary.count || 0);

  productRatingEl.style.display = "flex";

  const stars = createStarDisplay(average);
  productRatingEl.appendChild(stars);

  if (count > 0) {
    const avgSpan = document.createElement("span");
    avgSpan.className = "rating-average";
    avgSpan.textContent = average.toFixed(1);

    const countSpan = document.createElement("span");
    countSpan.className = "rating-count";
    countSpan.textContent = `(${count} ${count === 1 ? "rating" : "ratings"
      })`;

    productRatingEl.appendChild(avgSpan);
    productRatingEl.appendChild(countSpan);
  } else {
    const noRatings = document.createElement("span");
    noRatings.className = "no-ratings";
    noRatings.textContent = "No ratings yet";
    productRatingEl.appendChild(noRatings);
  }
}

/* =========================================================
   QUANTITY
   ========================================================= */

function configureQuantity(stock) {
  qtyInput.min = "1";
  qtyInput.max = String(Math.max(1, stock));
  qtyInput.value = stock > 0 ? "1" : "1";

  const available = stock > 0;

  qtyInput.disabled = !available;
  qtyDec.disabled = !available;
  qtyInc.disabled = !available;
  addToCartBtn.disabled = !available;

  if (available) {
    addToCartBtn.innerHTML = `
      <i class="ri-shopping-bag-line" aria-hidden="true"></i>
      <span>Add to Cart</span>
    `;
    quantityHint.textContent = `${stock} available`;
  } else {
    addToCartBtn.innerHTML = `
      <i class="ri-close-circle-line" aria-hidden="true"></i>
      <span>Out of Stock</span>
    `;
    quantityHint.textContent = "Currently unavailable";
  }

  updateQtyButtons();
}

function getSafeQuantity() {
  const min = 1;
  const max = Math.max(1, Number(qtyInput.max));

  let quantity = Number(qtyInput.value);

  if (!Number.isInteger(quantity)) {
    quantity = min;
  }

  quantity = Math.max(min, Math.min(quantity, max));
  qtyInput.value = String(quantity);

  return quantity;
}

function updateQtyButtons() {
  const value = getSafeQuantity();
  const max = Number(qtyInput.max);

  qtyDec.disabled = qtyInput.disabled || value <= 1;
  qtyInc.disabled = qtyInput.disabled || value >= max;
}

qtyDec?.addEventListener("click", () => {
  const current = getSafeQuantity();
  qtyInput.value = String(Math.max(1, current - 1));
  updateQtyButtons();
});

qtyInc?.addEventListener("click", () => {
  const current = getSafeQuantity();
  const max = Number(qtyInput.max);
  qtyInput.value = String(Math.min(max, current + 1));
  updateQtyButtons();
});

qtyInput?.addEventListener("input", updateQtyButtons);

qtyInput?.addEventListener("blur", () => {
  getSafeQuantity();
  updateQtyButtons();
});

/* =========================================================
   ADD TO CART
   ========================================================= */

addToCartBtn?.addEventListener("click", () => {
  if (!currentProduct) {
    return;
  }

  const stock = getStock(currentProduct);
  if (stock <= 0) {
    return;
  }

  const quantity = getSafeQuantity();
  if (!Number.isInteger(quantity) || quantity < 1) {
    return;
  }

  const existingQuantity = cart.getQuantity(currentProduct.id);
  const newQuantity = existingQuantity + quantity;

  if (newQuantity > stock) {
    showStockLimitFeedback(stock, existingQuantity);
    return;
  }

  try {
    cart.addToCart(currentProduct.id, quantity);
    showAddedFeedback();
    updateGlobalCartCount();
  } catch (error) {
    console.error("Failed to add product to cart:", error);
  }
});

function showAddedFeedback() {
  const originalMarkup = `
    <i class="ri-shopping-bag-line" aria-hidden="true"></i>
    <span>Add to Cart</span>
  `;

  addToCartBtn.innerHTML = `
    <i class="ri-check-line" aria-hidden="true"></i>
    <span>Added to Cart</span>
  `;
  addToCartBtn.disabled = true;

  window.setTimeout(() => {
    if (!currentProduct || getStock(currentProduct) <= 0) {
      return;
    }

    addToCartBtn.innerHTML = originalMarkup;
    addToCartBtn.disabled = false;
  }, 1300);
}

function showStockLimitFeedback(stock, existingQuantity) {
  const availableToAdd = Math.max(0, stock - existingQuantity);
  const originalMarkup = addToCartBtn.innerHTML;

  addToCartBtn.innerHTML = `
    <i class="ri-information-line" aria-hidden="true"></i>
    <span>
      ${availableToAdd > 0
      ? `Only ${availableToAdd} more available`
      : "Maximum in cart"
    }
    </span>
  `;
  addToCartBtn.disabled = true;

  window.setTimeout(() => {
    addToCartBtn.innerHTML = originalMarkup;
    addToCartBtn.disabled = false;
  }, 1600);
}

/* =========================================================
   CART COUNT
   ========================================================= */

function updateGlobalCartCount() {
  const cartCount = document.getElementById("cart-count");
  if (cartCount) {
    cartCount.textContent = String(cart.getCartItemCount());
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

/* =========================================================
   LOAD PRODUCT
   ========================================================= */

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const rawProductId = params.get("id");

  if (!rawProductId) {
    showInvalid();
    return;
  }

  /*
   * Strict integer validation.
   *
   * Number("1.5") => 1.5
   * Number("abc") => NaN
   * Number("1")   => 1
   */
  const productId = Number(rawProductId);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    rawProductId.trim() !== String(productId)
  ) {
    showInvalid();
    return;
  }

  showLoading();

  try {
    const result = await getProductById(productId);

    if (!result || !result.success) {
      if (
        result &&
        typeof result.message === "string" &&
        result.message.toLowerCase().includes("not found")
      ) {
        showNotFound();
        return;
      }

      showError();
      return;
    }

    if (!result.data) {
      showNotFound();
      return;
    }

    renderProduct(result.data);
  } catch (error) {
    console.error("Failed to load product:", error);
    showError();
  }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();
  updateGlobalCartCount();
});