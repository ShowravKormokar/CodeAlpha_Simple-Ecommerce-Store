import { getProductById } from "./api.js";
import * as cart from "./cart.js";
import { createStarDisplay } from "./stars.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const notFoundEl = document.getElementById("not-found-state");
const invalidEl = document.getElementById("invalid-state");
const detailsEl = document.getElementById("product-details");

const detailImage = document.getElementById("detail-image");
const detailName = document.getElementById("detail-name");
const detailPrice = document.getElementById("detail-price");
const detailDescription = document.getElementById("detail-description");
const detailStock = document.getElementById("detail-stock");
const productRatingEl = document.getElementById("product-rating");

const qtyDec = document.getElementById("qty-dec");
const qtyInput = document.getElementById("qty-input");
const qtyInc = document.getElementById("qty-inc");
const addToCartBtn = document.getElementById("add-to-cart");

let currentProduct = null;

function showLoading() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showError() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showNotFound() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "block";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showInvalid() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "block";
  detailsEl.style.display = "none";
}

function showDetails(product) {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "grid";

  detailImage.src = product.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='20'%3ENo image%3C/text%3E%3C/svg%3E";
  detailImage.alt = product.name;

  detailName.textContent = product.name;
  detailPrice.textContent = formatPrice(product.price);
  detailDescription.textContent = product.description || "";
  detailStock.textContent = formatStock(product.stock_quantity);
  detailStock.className = "detail-stock " + stockClass(product.stock_quantity);

  // Render product rating summary.
  renderProductRating(product.rating);

  currentProduct = product;

  const stockNum = Number(product.stock_quantity);
  qtyInput.value = 1;
  qtyInput.max = String(stockNum > 0 ? stockNum : 1);

  if (stockNum <= 0) {
    addToCartBtn.disabled = true;
    addToCartBtn.textContent = "Out of stock";
    qtyInc.disabled = true;
    qtyDec.disabled = true;
  } else {
    addToCartBtn.disabled = false;
    addToCartBtn.textContent = "Add to Cart";
    qtyInc.disabled = false;
    qtyDec.disabled = false;
  }
}

function renderProductRating(ratingSummary) {
  if (!ratingSummary) {
    productRatingEl.style.display = "none";
    return;
  }

  const { average, count } = ratingSummary;

  productRatingEl.innerHTML = "";
  productRatingEl.style.display = "flex";
  productRatingEl.style.alignItems = "center";
  productRatingEl.style.flexWrap = "wrap";

  const stars = createStarDisplay(average);
  productRatingEl.appendChild(stars);

  if (count > 0) {
    const avgSpan = document.createElement("span");
    avgSpan.className = "rating-average";
    avgSpan.textContent = average.toFixed(1);
    productRatingEl.appendChild(avgSpan);

    const countSpan = document.createElement("span");
    countSpan.className = "rating-count";
    countSpan.textContent = `(${count} rating${count > 1 ? "s" : ""})`;
    productRatingEl.appendChild(countSpan);
  } else {
    const noRatings = document.createElement("span");
    noRatings.className = "no-ratings";
    noRatings.textContent = "No ratings yet";
    productRatingEl.appendChild(noRatings);
  }
}

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function formatStock(quantity) {
  const num = Number(quantity);
  if (Number.isNaN(num) || num <= 0) return "Out of stock";
  return `In stock: ${num}`;
}

function stockClass(quantity) {
  const num = Number(quantity);
  if (Number.isNaN(num) || num <= 0) return "out-of-stock";
  return "in-stock";
}

function updateQtyButtons() {
  const val = Number(qtyInput.value);
  const max = Number(qtyInput.max);
  qtyDec.disabled = val <= 1;
  qtyInc.disabled = val >= max;
}

qtyDec.addEventListener("click", () => {
  const val = Math.max(1, Number(qtyInput.value) - 1);
  qtyInput.value = String(val);
  updateQtyButtons();
});

qtyInc.addEventListener("click", () => {
  const val = Math.min(Number(qtyInput.max), Number(qtyInput.value) + 1);
  qtyInput.value = String(val);
  updateQtyButtons();
});

qtyInput.addEventListener("input", () => {
  const max = Number(qtyInput.max);
  let val = Number(qtyInput.value);
  if (Number.isNaN(val) || val < 1) val = 1;
  if (val > max) val = max;
  qtyInput.value = String(val);
  updateQtyButtons();
});

addToCartBtn.addEventListener("click", () => {
  if (!currentProduct) return;
  const stockNum = Number(currentProduct.stock_quantity);
  if (stockNum <= 0) return;

  const quantity = Number(qtyInput.value);
  if (!Number.isInteger(quantity) || quantity < 1) return;

  const existingQty = cart.getQuantity(currentProduct.id);
  const newTotal = existingQty + quantity;
  if (newTotal > stockNum) {
    alert(`Only ${stockNum} available in stock.`);
    qtyInput.value = String(Math.max(1, stockNum - existingQty));
    updateQtyButtons();
    return;
  }

  cart.addToCart(currentProduct.id, quantity);
  const count = cart.getCartItemCount();
  addToCartBtn.textContent = `✓ Added to Cart`;
  setTimeout(() => {
    addToCartBtn.textContent = "Add to Cart";
  }, 1500);
});

async function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  if (!productId) {
    showInvalid();
    return;
  }

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    showInvalid();
    return;
  }

  showLoading();

  try {
    const result = await getProductById(id);

    if (!result || !result.success) {
      if (result && result.message === "Product not found") {
        showNotFound();
        return;
      }
      showError();
      return;
    }

    showDetails(result.data);
  } catch (error) {
    console.error("Failed to load product:", error);
    showError();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadProduct();
  updateQtyButtons();
});