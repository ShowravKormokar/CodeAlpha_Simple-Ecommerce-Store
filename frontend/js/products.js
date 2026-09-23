import { getProducts } from "./api.js";
import * as cart from "./cart.js";
import { createStarDisplay } from "./stars.js";

const productsGrid = document.getElementById("products-grid");
const loadingEl = document.getElementById("loading");
const emptyEl = document.getElementById("empty-state");
const errorEl = document.getElementById("error-state");
const retryBtn = document.getElementById("retry-btn");
const productCountEl = document.getElementById("product-count");

const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23f2f3f6'/%3E%3Ctext x='50%25' y='48%25' dominant-baseline='middle' text-anchor='middle' fill='%23b7bac4' font-size='28' font-family='Arial'%3ENo image%3C/text%3E%3C/svg%3E";

/* =========================================================
   STATE MANAGEMENT
   ========================================================= */

function showLoading() {
  loadingEl.style.display = "flex";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = "none";
  updateProductCount("Loading products...");
}

function showError() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "flex";
  productsGrid.style.display = "none";
  updateProductCount("Products unavailable");
}

function showEmpty() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "flex";
  errorEl.style.display = "none";
  productsGrid.style.display = "none";
  updateProductCount("0 products");
}

function showProducts(products) {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  productsGrid.style.display = "grid";
  updateProductCount(
    `${products.length} ${products.length === 1 ? "product" : "products"}`
  );
  renderProducts(products);
}

function updateProductCount(text) {
  const textElement = productCountEl?.querySelector("span");
  if (textElement) {
    textElement.textContent = text;
  }
}

/* =========================================================
   PRODUCT RENDERING
   ========================================================= */

function renderProducts(products) {
  productsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  products.forEach((product) => {
    fragment.appendChild(createProductCard(product));
  });

  productsGrid.appendChild(fragment);
  attachProductEvents();
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

  imageLink.appendChild(imageWrapper);
  imageLink.appendChild(badge);

  /* ---------- Body ---------- */
  const body = document.createElement("div");
  body.className = "product-card-body";

  const category = document.createElement("span");
  category.className = "product-category";
  category.textContent = "Product";

  const name = document.createElement("h2");
  name.className = "product-name";
  name.textContent = product.name || "Unnamed product";
  name.title = product.name || "Unnamed product";

  const description = document.createElement("p");
  description.className = "product-description";
  description.textContent =
    product.description || "Discover this product in our collection.";

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

  const price = document.createElement("p");
  price.className = "product-price";
  price.textContent = formatPrice(product.price);

  const stockText = document.createElement("p");
  stockText.className = `product-stock ${hasStock ? "" : "out-of-stock"}`;
  stockText.textContent = hasStock
    ? `${stock} available`
    : "Currently unavailable";

  pricing.appendChild(price);
  pricing.appendChild(stockText);

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

function attachProductEvents() {
  const buttons = productsGrid.querySelectorAll(
    ".product-add-button:not(:disabled)"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        return;
      }

      const product = currentProducts.find(
        (item) => Number(item.id) === productId
      );

      if (!product) return;

      handleAddToCart(product, button);
    });
  });
}

let currentProducts = [];

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

/* =========================================================
   LOAD PRODUCTS
   ========================================================= */

async function loadProducts() {
  showLoading();

  try {
    const result = await getProducts();

    if (!result || !result.success) {
      showError();
      return;
    }

    const products = Array.isArray(result.data) ? result.data : [];
    currentProducts = products;

    if (products.length === 0) {
      showEmpty();
      return;
    }

    showProducts(products);
  } catch (error) {
    console.error("Failed to load products:", error);
    showError();
  }
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  updateGlobalCartCount();
});

retryBtn?.addEventListener("click", loadProducts);