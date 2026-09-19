import { getProductById } from "./api.js";

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

document.addEventListener("DOMContentLoaded", loadProduct);