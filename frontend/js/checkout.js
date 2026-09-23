import * as cart from "./cart.js";
import { getProducts, getCurrentUser, createOrder } from "./api.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const emptyEl = document.getElementById("empty-state");
const contentEl = document.getElementById("checkout-content");
const form = document.getElementById("checkout-form");
const placeOrderBtn = document.getElementById("place-order-btn");
const btnText = placeOrderBtn.querySelector(".btn-text");
const btnLoading = placeOrderBtn.querySelector(".btn-loading");

const summaryItemsEl = document.getElementById("order-summary-items");
const summarySubtotalEl = document.getElementById("summary-subtotal");
const summaryShippingEl = document.getElementById("summary-shipping");
const summaryTaxEl = document.getElementById("summary-tax");
const summaryTotalEl = document.getElementById("summary-total");

let productsById = new Map();
let cartItems = [];

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function showLoading() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  contentEl.style.display = "none";
}

function showError(message) {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  contentEl.style.display = "none";
  errorMessageEl.textContent = message;
}

function showEmpty() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "block";
  contentEl.style.display = "none";
}

function showContent() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  contentEl.style.display = "block";
}

function setSubmitting(isSubmitting) {
  if (isSubmitting) {
    placeOrderBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline";
  } else {
    placeOrderBtn.disabled = false;
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
  }
}

function validateForm() {
  let isValid = true;
  const requiredFields = [
    "shippingName",
    "shippingEmail",
    "shippingPhone",
    "shippingAddressLine1",
    "shippingCity",
    "shippingState",
    "shippingPostalCode",
    "shippingCountry",
  ];

  requiredFields.forEach((fieldName) => {
    const input = form.elements.namedItem(fieldName);
    const errorEl = document.getElementById(`error-${fieldName.toLowerCase()}`);
    if (!input.value.trim()) {
      input.classList.add("invalid");
      if (errorEl) errorEl.textContent = "This field is required.";
      isValid = false;
    } else {
      input.classList.remove("invalid");
      if (errorEl) errorEl.textContent = "";
    }
  });

  // Email validation
  const emailInput = form.elements.namedItem("shippingEmail");
  if (emailInput.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
    emailInput.classList.add("invalid");
    document.getElementById("error-shippingemail").textContent = "Please enter a valid email address.";
    isValid = false;
  }

  return isValid;
}

function clearFieldError(fieldName) {
  const input = form.elements.namedItem(fieldName);
  const errorEl = document.getElementById(`error-${fieldName.toLowerCase()}`);
  input.classList.remove("invalid");
  if (errorEl) errorEl.textContent = "";
}

function renderOrderSummary(items) {
  summaryItemsEl.innerHTML = "";

  items.forEach((item) => {
    const product = productsById.get(item.productId);
    if (!product) return;

    const itemEl = document.createElement("div");
    itemEl.className = "summary-item";
    itemEl.innerHTML = `
      <div class="summary-item-info">
        <img src="${product.image_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23ddd'/%3E%3C/svg%3E"}" alt="${product.name}" width="60" height="60" />
        <div>
          <strong>${product.name}</strong>
          <span class="muted">Qty: ${item.quantity}</span>
        </div>
      </div>
      <span class="summary-item-price">${formatPrice(Number(product.price) * item.quantity)}</span>
    `;
    summaryItemsEl.appendChild(itemEl);
  });

  let subtotal = 0;
  items.forEach((item) => {
    const product = productsById.get(item.productId);
    if (product) {
      subtotal += Number(product.price) * item.quantity;
    }
  });

  const shipping = 0; // Free shipping for now
  const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
  const total = subtotal + shipping + tax;

  summarySubtotalEl.textContent = formatPrice(subtotal);
  summaryShippingEl.textContent = formatPrice(shipping);
  summaryTaxEl.textContent = formatPrice(tax);
  summaryTotalEl.textContent = formatPrice(total);
}

async function loadCheckout() {
  showLoading();

  cartItems = cart.getCart();

  if (cartItems.length === 0) {
    showEmpty();
    return;
  }

  // Check authentication
  const auth = await getCurrentUser();
  if (!auth.authenticated) {
    showError("Please log in to place an order. <a href='login.html'>Go to login</a>");
    return;
  }

  try {
    const result = await getProducts();

    if (!result || !result.success) {
      showError("Unable to load product information.");
      return;
    }

    productsById = new Map(
      (result.data || []).map((p) => [Number(p.id), p])
    );

    renderOrderSummary(cartItems);
    showContent();
  } catch (error) {
    console.error("Failed to load checkout:", error);
    showError("Unable to load checkout. Please try again.");
  }
}

function collectShippingInfo() {
  return {
    name: form.elements.namedItem("shippingName").value.trim(),
    email: form.elements.namedItem("shippingEmail").value.trim(),
    phone: form.elements.namedItem("shippingPhone").value.trim(),
    addressLine1: form.elements.namedItem("shippingAddressLine1").value.trim(),
    addressLine2: form.elements.namedItem("shippingAddressLine2").value.trim(),
    city: form.elements.namedItem("shippingCity").value.trim(),
    state: form.elements.namedItem("shippingState").value.trim(),
    postalCode: form.elements.namedItem("shippingPostalCode").value.trim(),
    country: form.elements.namedItem("shippingCountry").value.trim(),
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setSubmitting(true);

  const shippingInfo = collectShippingInfo();

  try {
    const result = await createOrder(cartItems, shippingInfo);

    if (result.status === 201 && result.data.success) {
      const order = result.data.data.order;

      // Clear cart
      cart.clearCart();

      // Redirect to order details page with the new order ID
      window.location.href = `order-details.html?id=${order.id}`;
    } else if (result.status === 401) {
      alert("Please log in to place an order.");
      window.location.href = "login.html";
    } else if (result.status === 404) {
      alert(result.data.message || "A product in your cart was not found.");
    } else if (result.status === 409) {
      alert(result.data.message || "Insufficient stock for an item in your cart.");
    } else if (result.status === 400) {
      alert(result.data.message || "Invalid order request.");
    } else {
      alert("Unable to place your order. Please try again.");
    }
  } catch (error) {
    console.error("Checkout error:", error);
    alert("Unable to place your order. Please try again.");
  } finally {
    setSubmitting(false);
  }
}

// Add real-time validation clearing
["shippingName", "shippingEmail", "shippingPhone", "shippingAddressLine1", "shippingCity", "shippingState", "shippingPostalCode", "shippingCountry"].forEach((fieldName) => {
  const input = form.elements.namedItem(fieldName);
  if (input) {
    input.addEventListener("input", () => clearFieldError(fieldName));
    input.addEventListener("blur", () => clearFieldError(fieldName));
  }
});

form.addEventListener("submit", handleSubmit);

document.addEventListener("DOMContentLoaded", loadCheckout);