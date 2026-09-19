import { getProducts } from "./api.js";

const productsGrid = document.getElementById("products-grid");
const loadingEl = document.getElementById("loading");
const emptyEl = document.getElementById("empty-state");
const errorEl = document.getElementById("error-state");
const retryBtn = document.getElementById("retry-btn");

function showLoading() {
  loadingEl.style.display = "block";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = "none";
}

function showError() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "block";
  productsGrid.style.display = "none";
}

function showEmpty() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "block";
  errorEl.style.display = "none";
  productsGrid.style.display = "none";
}

function showProducts(products) {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = "grid";
  renderProducts(products);
}

function renderProducts(products) {
  productsGrid.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";

    const img = document.createElement("img");
    img.src = product.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3ENo image%3C/text%3E%3C/svg%3E";
    img.alt = product.name;
    img.onerror = function () {
      this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999'%3ENo image%3C/text%3E%3C/svg%3E";
    };

    const body = document.createElement("div");
    body.className = "product-card-body";

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;

    const desc = document.createElement("p");
    desc.className = "product-description";
    desc.textContent = product.description || "";

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);

    const stock = document.createElement("p");
    stock.className = "product-stock";
    stock.textContent = formatStock(product.stock_quantity);

    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = `product-details.html?id=${product.id}`;
    link.textContent = "View Details";

    body.appendChild(name);
    body.appendChild(desc);
    body.appendChild(price);
    body.appendChild(stock);
    body.appendChild(link);

    card.appendChild(img);
    card.appendChild(body);

    productsGrid.appendChild(card);
  });
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

async function loadProducts() {
  showLoading();
  try {
    const result = await getProducts();

    if (!result || !result.success) {
      showError();
      return;
    }

    if (!result.data || result.data.length === 0) {
      showEmpty();
      return;
    }

    showProducts(result.data);
  } catch (error) {
    console.error("Failed to load products:", error);
    showError();
  }
}

document.addEventListener("DOMContentLoaded", loadProducts);
retryBtn.addEventListener("click", loadProducts);