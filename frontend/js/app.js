import { getCurrentUser, logoutUser, getProducts } from "./api.js";
import * as cart from "./cart.js";

/* =========================================================
   NAVIGATION HELPERS
   ========================================================= */

function getCurrentPage() {
  const path = window.location.pathname;
  const file = path.split("/").pop();
  return file || "index.html";
}

function isActive(page) {
  return getCurrentPage() === page ? "active" : "";
}

function getCartCount() {
  return cart.getCartItemCount();
}

/* =========================================================
   NAVIGATION RENDERING
   ========================================================= */

function renderLoggedOutNavigation() {
  const count = getCartCount();

  return `
    <li>
      <a href="index.html" class="${isActive("index.html")}">
        <i class="ri-home-5-line" aria-hidden="true"></i>
        <span>Home</span>
      </a>
    </li>

    <li>
      <a href="products.html" class="${isActive("products.html")}">
        <i class="ri-store-2-line" aria-hidden="true"></i>
        <span>Products</span>
      </a>
    </li>

    <li>
      <a href="cart.html" class="${isActive("cart.html")}">
        <i class="ri-shopping-cart-2-line" aria-hidden="true"></i>
        <span>Cart</span>
        ${count > 0 ? `<span class="nav-cart-count">${count}</span>` : ""}
      </a>
    </li>

    <li>
      <a href="login.html" class="${isActive("login.html")}">
        <i class="ri-login-box-line" aria-hidden="true"></i>
        <span>Login</span>
      </a>
    </li>

    <li>
      <a href="register.html" class="${isActive("register.html")}">
        <i class="ri-user-add-line" aria-hidden="true"></i>
        <span>Register</span>
      </a>
    </li>
  `;
}

function renderLoggedInNavigation(user) {
  const count = getCartCount();

  return `
    <li>
      <a href="index.html" class="${isActive("index.html")}">
        <i class="ri-home-5-line" aria-hidden="true"></i>
        <span>Home</span>
      </a>
    </li>

    <li>
      <a href="products.html" class="${isActive("products.html")}">
        <i class="ri-store-2-line" aria-hidden="true"></i>
        <span>Products</span>
      </a>
    </li>

    <li>
      <a href="cart.html" class="${isActive("cart.html")}">
        <i class="ri-shopping-cart-2-line" aria-hidden="true"></i>
        <span>Cart</span>
        ${count > 0 ? `<span class="nav-cart-count">${count}</span>` : ""}
      </a>
    </li>

    <li>
      <a
        href="orders.html"
        class="${isActive("orders.html") || getCurrentPage() === "order-details.html"
      ? "active"
      : ""
    }"
      >
        <i class="ri-file-list-3-line" aria-hidden="true"></i>
        <span>Orders</span>
      </a>
    </li>

    <li>
      <a
        href="my-account.html"
        class="account-link ${isActive("my-account.html")}"
        aria-label="My account"
      >
        <span class="account-icon">
          <i class="ri-user-3-line" aria-hidden="true"></i>
        </span>

        <span class="account-name">
          ${escapeHtml(user.name)}
        </span>
      </a>
    </li>
  `;
}

/* =========================================================
   UPDATE NAVIGATION
   ========================================================= */

async function updateNavigation() {
  const navLinks = document.getElementById("nav-links");
  if (!navLinks) return;

  try {
    const result = await getCurrentUser();

    if (result?.authenticated && result?.data?.user) {
      navLinks.innerHTML = renderLoggedInNavigation(result.data.user);
    } else {
      navLinks.innerHTML = renderLoggedOutNavigation();
    }
  } catch (error) {
    console.error("Failed to update navigation:", error);
    navLinks.innerHTML = renderLoggedOutNavigation();
  }

  setupMobileNavigation();
}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function setupMobileNavigation() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const navLinks = document.getElementById("nav-links");

  if (!toggle || !navLinks) return;

  /*
   * Prevent duplicate listeners
   * if updateNavigation() runs again.
   */
  if (toggle.dataset.initialized === "true") {
    return;
  }

  toggle.dataset.initialized = "true";

  toggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");

    toggle.setAttribute("aria-expanded", String(isOpen));

    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = isOpen ? "ri-close-line" : "ri-menu-line";
    }
  });

  navLinks.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    navLinks.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");

    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = "ri-menu-line";
    }
  });
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function handleLogout(event) {
  event.preventDefault();

  try {
    await logoutUser();
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout error:", error);
  }
}

/* =========================================================
   FEATURED PRODUCTS
   ========================================================= */

async function loadFeaturedProducts() {
  const productsGrid = document.getElementById("featured-products-grid");
  const errorState = document.getElementById("featured-error");
  const retryButton = document.getElementById("retry-products");

  if (!productsGrid) return;

  try {
    productsGrid.innerHTML = `
      <div class="products-loading">
        <span class="loading-spinner"></span>
        <p>Loading products...</p>
      </div>
    `;

    errorState?.classList.add("hidden");

    const result = await getProducts();

    if (!result || !result.success) {
      throw new Error(result?.message || "Unable to load products.");
    }

    const products = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.products)
        ? result.data.products
        : [];

    if (products.length === 0) {
      productsGrid.innerHTML = `
        <div class="products-loading">
          <div class="empty-state-icon">
            <i class="ri-shopping-bag-line" aria-hidden="true"></i>
          </div>
          <p>No products are available right now.</p>
        </div>
      `;
      return;
    }

    // Keep the homepage focused. Show only the first four products.
    const featuredProducts = products.slice(0, 4);

    productsGrid.innerHTML = featuredProducts.map(createProductCard).join("");

    attachProductCardEvents();
  } catch (error) {
    console.error("Failed to load featured products:", error);

    productsGrid.innerHTML = "";
    errorState?.classList.remove("hidden");

    if (retryButton) {
      retryButton.onclick = loadFeaturedProducts;
    }
  }
}

/* =========================================================
   PRODUCT CARD
   ========================================================= */

function createProductCard(product) {
  const id = Number(product.id);
  const name = escapeHtml(product.name || "Product");
  const description = escapeHtml(
    product.description || "Discover this product in our collection."
  );

  const price = formatPrice(product.price);

  const stock = Number(product.stock_quantity ?? 0);
  const hasStock = stock > 0;

  const imageUrl = product.image_url
    ? escapeAttribute(product.image_url)
    : "";

  const imageMarkup = imageUrl
    ? `
      <img
        src="${imageUrl}"
        alt="${name}"
        loading="lazy"
        data-product-image
      />
    `
    : `
      <div class="product-image-placeholder" aria-hidden="true">
        <i class="ri-image-line"></i>
      </div>
    `;

  return `
    <article class="product-card" data-product-id="${id}">
      <a
        href="product-details.html?id=${encodeURIComponent(id)}"
        class="product-image"
        aria-label="View ${name} details"
      >
        ${imageMarkup}

        <span class="product-stock-badge ${hasStock ? "" : "out-of-stock"}">
          ${hasStock ? "In stock" : "Out of stock"}
        </span>
      </a>

      <div class="product-content">
        <h3 class="product-name" title="${name}">
          ${name}
        </h3>

        <p class="product-description">
          ${description}
        </p>

        <div class="product-footer">
          <span class="product-price">${price}</span>

          <button
            class="product-card-button add-to-cart-button"
            type="button"
            data-product-id="${id}"
            aria-label="Add ${name} to cart"
            title="${hasStock ? "Add to cart" : "Out of stock"}"
            ${hasStock ? "" : "disabled"}
          >
            <i class="ri-shopping-bag-line" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </article>
  `;
}

function attachProductCardEvents() {
  const buttons = document.querySelectorAll(".add-to-cart-button");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const productId = Number(button.dataset.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        return;
      }

      try {
        cart.addToCart(productId, 1);
        updateCartCount();

        const originalIcon = button.innerHTML;

        button.innerHTML = '<i class="ri-check-line" aria-hidden="true"></i>';
        button.setAttribute("aria-label", "Added to cart");

        window.setTimeout(() => {
          button.innerHTML = originalIcon;
          button.setAttribute("aria-label", "Add to cart");
        }, 1200);
      } catch (error) {
        console.error("Failed to add product to cart:", error);
      }
    });
  });

  const images = document.querySelectorAll("[data-product-image]");

  images.forEach((image) => {
    image.addEventListener("error", () => {
      image.style.display = "none";

      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.innerHTML = '<i class="ri-image-line"></i>';

      image.parentElement?.appendChild(placeholder);
    });
  });
}

/* =========================================================
   CART COUNT
   ========================================================= */

function updateCartCount() {
  const cartCountElement = document.getElementById("cart-count");
  if (!cartCountElement) return;

  cartCountElement.textContent = String(cart.getCartItemCount());

  // Also refresh navigation cart badge, if present.
  const navBadge = document.querySelector(".nav-cart-count");
  if (navBadge) {
    const count = cart.getCartItemCount();
    if (count > 0) {
      navBadge.textContent = String(count);
    } else {
      navBadge.remove();
    }
  }
}

/* =========================================================
   HELPERS
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

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeHomePage() {
  await updateNavigation();
  await loadFeaturedProducts();
  updateCartCount();
}

document.addEventListener("DOMContentLoaded", initializeHomePage);