import * as cart from "./cart.js";
import { getProducts } from "./api.js";

const loadingEl = document.getElementById("loading");
const emptyEl = document.getElementById("empty-state");
const errorEl = document.getElementById("error-state");
const itemsContainer = document.getElementById("cart-items-container");
const summaryEl = document.getElementById("cart-summary");
const retryBtn = document.getElementById("retry-cart");
const clearCartBtn = document.getElementById("clear-cart-btn");
const checkoutBtn = document.getElementById("checkout-btn");
const navCartCount = document.getElementById("nav-cart-count");

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function updateNavCount() {
  if (navCartCount) {
    navCartCount.textContent = cart.getCartItemCount();
  }
}

function showLoading() {
  loadingEl.style.display = "block";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}

function showEmpty() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "block";
  errorEl.style.display = "none";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}

function showError() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "block";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}

function showCart(items, productsById) {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  itemsContainer.style.display = "block";
  summaryEl.style.display = "block";

  renderItems(items, productsById);
  renderSummary(items, productsById);
}

function renderItems(items, productsById) {
  itemsContainer.innerHTML = "";

  items.forEach((item) => {
    const product = productsById.get(item.productId);
    const row = document.createElement("article");
    row.className = "cart-item";

    if (!product) {
      row.innerHTML = `
        <div class="cart-item-info">
          <p class="muted">Product #${item.productId} is no longer available.</p>
        </div>
        <button class="btn btn-secondary" data-remove="${item.productId}">Remove</button>
      `;
      itemsContainer.appendChild(row);
      return;
    }

    const img = document.createElement("img");
    img.src = product.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23ddd'/%3E%3C/svg%3E";
    img.alt = product.name;
    img.onerror = function () {
      this.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23ddd'/%3E%3C/svg%3E";
    };

    const info = document.createElement("div");
    info.className = "cart-item-info";

    const name = document.createElement("h3");
    name.className = "cart-item-name";
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "cart-item-price";
    price.textContent = formatPrice(product.price);

    const stock = document.createElement("p");
    stock.className = "cart-item-stock";
    const stockNum = Number(product.stock_quantity);
    if (stockNum <= 0) {
      stock.textContent = "Out of stock";
      stock.classList.add("out-of-stock");
    } else if (stockNum < 5) {
      stock.textContent = `Low stock: ${stockNum} left`;
      stock.classList.add("low-stock");
    } else {
      stock.textContent = `In stock: ${stockNum}`;
      stock.classList.add("in-stock");
    }

    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(stock);

    const controls = document.createElement("div");
    controls.className = "cart-item-controls";

    const dec = document.createElement("button");
    dec.className = "qty-btn";
    dec.type = "button";
    dec.textContent = "−";
    dec.setAttribute("aria-label", `Decrease quantity of ${product.name}`);
    dec.addEventListener("click", () => handleDecrease(item.productId));

    const qty = document.createElement("span");
    qty.className = "qty-value";
    qty.textContent = item.quantity;

    const inc = document.createElement("button");
    inc.className = "qty-btn";
    inc.type = "button";
    inc.textContent = "+";
    inc.setAttribute("aria-label", `Increase quantity of ${product.name}`);
    if (stockNum > 0 && item.quantity >= stockNum) {
      inc.disabled = true;
      inc.title = `Cannot exceed available stock (${stockNum})`;
    }
    inc.addEventListener("click", () => handleIncrease(item.productId, stockNum));

    controls.appendChild(dec);
    controls.appendChild(qty);
    controls.appendChild(inc);

    const subtotal = document.createElement("div");
    subtotal.className = "cart-item-subtotal";
    subtotal.textContent = formatPrice(Number(product.price) * item.quantity);

    const remove = document.createElement("button");
    remove.className="btn btn-secondary remove-btn";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${product.name} from cart`);
    remove.addEventListener("click", () => handleRemove(item.productId));

    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(controls);
    row.appendChild(subtotal);
    row.appendChild(remove);

    itemsContainer.appendChild(row);
  });
}

function renderSummary(items, productsById) {
  let subtotal = 0;
  items.forEach((item) => {
    const product = productsById.get(item.productId);
    if (product) {
      subtotal += Number(product.price) * item.quantity;
    }
  });

  document.getElementById("cart-subtotal").textContent = formatPrice(subtotal);
  document.getElementById("cart-total").textContent = formatPrice(subtotal);
}

function handleIncrease(productId, stockLimit) {
  const updated = cart.increaseQuantity(productId);
  if (!updated) return;
  if (stockLimit > 0) {
    const item = updated.find((i) => i.productId === productId);
    if (item && item.quantity > stockLimit) {
      cart.updateCartItem(productId, stockLimit);
    }
  }
  loadCart();
}

function handleDecrease(productId) {
  cart.decreaseQuantity(productId);
  loadCart();
}

function handleRemove(productId) {
  cart.removeFromCart(productId);
  loadCart();
}

async function loadCart() {
  updateNavCount();

  const cartItems = cart.getCart();

  if (cartItems.length === 0) {
    showEmpty();
    return;
  }

  showLoading();

  try {
    const result = await getProducts();

    if (!result || !result.success) {
      showError();
      return;
    }

    const productsById = new Map(
      (result.data || []).map((p) => [Number(p.id), p])
    );

    showCart(cartItems, productsById);
  } catch (error) {
    console.error("Failed to load cart products:", error);
    showError();
  }
}

clearCartBtn.addEventListener("click", () => {
  cart.clearCart();
  loadCart();
});

checkoutBtn.addEventListener("click", () => {
  alert("Checkout will be available in the next phase.");
});

retryBtn.addEventListener("click", loadCart);

document.addEventListener("DOMContentLoaded", () => {
  updateNavCount();
  loadCart();
});