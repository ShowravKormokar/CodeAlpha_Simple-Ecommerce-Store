import { getCurrentUser, logoutUser, getProducts } from "./api.js";
import * as cart from "./cart.js";

/* =========================================================
   NAVIGATION
   ========================================================= */

async function updateNavigation() {
  const navLinks = document.getElementById("nav-links");
  if (!navLinks) return;

  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  const isActive = (page) =>
    currentPage === page ? "active" : "";

  const cartCount = cart.getCartItemCount();

  const cartLink = `
    <li>
      <a href="cart.html" class="${isActive("cart.html")}">
        Cart <span class="cart-count">${cartCount}</span>
      </a>
    </li>
  `;

  try {
    const result = await getCurrentUser();

    if (result?.authenticated && result?.data) {
      const user = result.data.user ?? result.data;

      navLinks.innerHTML = `
        <li>
          <a href="index.html" class="${isActive("index.html")}">
            Home
          </a>
        </li>

        <li>
          <a href="products.html" class="${isActive("products.html")}">
            Products
          </a>
        </li>

        ${cartLink}

        <li>
          <a href="orders.html" class="${isActive("orders.html")}">
            Orders
          </a>
        </li>

        <li>
          <a href="my-account.html"
             class="account-link ${isActive("my-account.html")}"
             aria-label="My Account"
             title="My Account">
            <span class="account-icon" aria-hidden="true">
              <i class="ri-user-3-line"></i>
            </span>
            <span class="account-name">
              ${escapeHtml(user.name)}
            </span>
          </a>
        </li>
      `;

      return;
    }

    navLinks.innerHTML = `
      <li>
        <a href="index.html" class="${isActive("index.html")}">
          Home
        </a>
      </li>

      <li>
        <a href="products.html" class="${isActive("products.html")}">
          Products
        </a>
      </li>

      ${cartLink}

      <li>
        <a href="login.html" class="${isActive("login.html")}">
          Login
        </a>
      </li>

      <li>
        <a href="register.html" class="${isActive("register.html")}">
          Register
        </a>
      </li>
    `;
  } catch (error) {
    console.error("Failed to update navigation:", error);

    navLinks.innerHTML = `
      <li>
        <a href="index.html" class="${isActive("index.html")}">
          Home
        </a>
      </li>

      <li>
        <a href="products.html" class="${isActive("products.html")}">
          Products
        </a>
      </li>

      ${cartLink}

      <li>
        <a href="login.html" class="${isActive("login.html")}">
          Login
        </a>
      </li>

      <li>
        <a href="register.html" class="${isActive("register.html")}">
          Register
        </a>
      </li>
    `;
  }
}

function renderGuestNavigation(navLinks, cartCount) {
  navLinks.innerHTML = `
    <li>
      <a href="index.html" class="active">
        <span>Home</span>
      </a>
    </li>

    <li>
      <a href="products.html">
        <span>Products</span>
      </a>
    </li>

    <li>
      <a href="cart.html" class="nav-cart-link">
        <i class="ri-shopping-bag-line" aria-hidden="true"></i>
        <span>Cart</span>
        <span class="cart-count" id="cart-count">${cartCount}</span>
      </a>
    </li>

    <li>
      <a href="login.html">Login</a>
    </li>

    <li>
      <a href="register.html" class="nav-register">Register</a>
    </li>
  `;
}

/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function setupMobileNavigation() {
  const toggle = document.getElementById("mobile-menu-toggle");
  const navCenter = document.querySelector(".nav-center");

  if (!toggle || !navCenter) return;

  toggle.addEventListener("click", () => {
    const isOpen = navCenter.classList.toggle("menu-open");

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );

    toggle.innerHTML = isOpen
      ? '<i class="ri-close-line" aria-hidden="true"></i>'
      : '<i class="ri-menu-line" aria-hidden="true"></i>';
  });

  navCenter.addEventListener("click", (event) => {
    const link = event.target.closest("a");

    if (!link) return;

    navCenter.classList.remove("menu-open");

    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation menu");

    toggle.innerHTML =
      '<i class="ri-menu-line" aria-hidden="true"></i>';
  });
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

    productsGrid.innerHTML = featuredProducts
      .map(createProductCard)
      .join("");

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

        button.innerHTML =
          '<i class="ri-check-line" aria-hidden="true"></i>';

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