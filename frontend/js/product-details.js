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
const detailPrice = document.getElementById("detail-price");
const detailDescription = document.getElementById("detail-description");
const detailStock = document.getElementById("detail-stock");
const detailStockBadge = document.getElementById("detail-stock-badge");
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
  detailPrice.textContent = formatPrice(product.price);
  detailDescription.textContent =
    product.description || "Discover this product from our collection.";

  const stock = getStock(product);
  renderStock(stock);
  renderProductImage(product);
  renderProductRating(product.rating);
  configureQuantity(stock);

  showDetails();
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