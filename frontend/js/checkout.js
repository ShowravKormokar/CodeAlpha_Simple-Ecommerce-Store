import * as cart from "./cart.js";

import {
  getProductById,
  getCurrentUser,
  createOrder,
} from "./api.js";

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
const summaryTotalEl = document.getElementById("summary-total");
const summaryNoteEl = document.getElementById("summary-note");
const inlineErrorEl = document.getElementById("checkout-inline-error");
const paymentStatusEl = document.getElementById("payment-status");
const cardProviderOptions = document.getElementById("card-provider-options");
const mobileProviderOptions = document.getElementById("mobile-provider-options");
const paymentDialog = document.getElementById("payment-dialog");
const paymentDialogTitle = document.getElementById("payment-dialog-title");
const paymentDialogDescription = document.getElementById("payment-dialog-description");
const cardPaymentForm = document.getElementById("card-payment-form");
const mobilePaymentForm = document.getElementById("mobile-payment-form");
const dialogCloseButton = document.getElementById("payment-dialog-close");

let productsById = new Map();
let cartItems = [];
let submitting = false;
let dialogReturnFocus = null;
let paymentState = {
  method: "CASH_ON_DELIVERY",
  provider: null,
  confirmed: true,
  summary: "Cash on Delivery",
};

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

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
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
  errorMessageEl.textContent = message || "There was a problem loading your cart.";
}

function showLoginRequired() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  contentEl.style.display = "none";
  errorEl.innerHTML = `
    <div class="state-icon state-icon-error">
      <i class="ri-lock-line" aria-hidden="true"></i>
    </div>
    <h2>Please log in</h2>
    <p>You need to be logged in to place an order.</p>
    <a class="btn btn-primary" href="login.html">
      <i class="ri-login-box-line" aria-hidden="true"></i>
      Log In
    </a>
  `;
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
  submitting = isSubmitting;
  placeOrderBtn.disabled = isSubmitting;
  btnText.style.display = isSubmitting ? "none" : "inline-flex";
  btnLoading.style.display = isSubmitting ? "inline-flex" : "none";
}

function setInlineError(message) {
  inlineErrorEl.textContent = message || "";
  inlineErrorEl.hidden = !message;
}

function getErrorElement(fieldName) {
  return document.getElementById(
    `error-${fieldName.replace(/[A-Z]/g, (char) => char.toLowerCase())}`
  );
}

function setFieldError(fieldName, message) {
  const input = form.elements.namedItem(fieldName);
  const errorElement = getErrorElement(fieldName);
  input?.classList.toggle("invalid", Boolean(message));
  if (input) input.setAttribute("aria-invalid", String(Boolean(message)));
  if (errorElement) errorElement.textContent = message || "";
}

function validateForm() {
  let isValid = true;

  requiredFields.forEach((fieldName) => {
    const input = form.elements.namedItem(fieldName);
    const value = input?.value.trim() || "";
    let message = value ? "" : "This field is required.";

    if (!message && fieldName === "shippingEmail" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      message = "Please enter a valid email address.";
    }

    if (!message && fieldName === "shippingPhone" && !/^[+\d][\d\s().-]{6,19}$/.test(value)) {
      message = "Please enter a valid phone number.";
    }

    setFieldError(fieldName, message);
    if (message) isValid = false;
  });

  return isValid;
}

function clearFieldError(fieldName) {
  const input = form.elements.namedItem(fieldName);
  if (input?.value.trim()) setFieldError(fieldName, "");
}

function getFieldElements(formElement, fieldName) {
  const field = formElement.elements.namedItem(fieldName);

  if (!field) return [];
  if (typeof field.length === "number") return Array.from(field);
  return [field];
}

function createPlaceholderImage() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23f1f5f9'/%3E%3C/svg%3E";
}

function renderOrderSummary(items) {
  summaryItemsEl.innerHTML = "";
  let subtotal = 0;
  let hasUnavailableItems = false;
  let hasStockConflict = false;

  items.forEach((item) => {
    const product = productsById.get(Number(item.productId));
    const itemEl = document.createElement("div");
    itemEl.className = "summary-item";
    const info = document.createElement("div");
    info.className = "summary-item-info";
    const text = document.createElement("div");
    const name = document.createElement("strong");
    const quantity = document.createElement("span");
    const price = document.createElement("span");
    let image = null;

    if (!product) {
      hasUnavailableItems = true;
      name.textContent = `Product #${item.productId}`;
      quantity.className = "muted summary-item-warning";
      quantity.textContent = "No longer available. It will remain in your cart.";
      price.className = "summary-item-price summary-item-warning";
      price.textContent = "—";
    } else {
      const unitPrice = Number(product.price);
      const stock = Number(product.stock_quantity);
      const quantityValue = Number(item.quantity);
      subtotal += unitPrice * quantityValue;
      name.textContent = product.name;
      image = document.createElement("img");
      image.src = product.image_url || createPlaceholderImage();
      image.alt = product.name;
      image.loading = "lazy";
      quantity.className = "muted";
      quantity.textContent = `Qty: ${quantityValue}`;
      price.className = "summary-item-price";
      price.textContent = formatPrice(unitPrice * quantityValue);
      if (!Number.isFinite(stock) || stock < quantityValue) hasStockConflict = true;
    }

    text.append(name, quantity);
    if (image) info.appendChild(image);
    info.appendChild(text);
    itemEl.append(info, price);
    summaryItemsEl.appendChild(itemEl);
  });

  summarySubtotalEl.textContent = formatPrice(subtotal);
  summaryTotalEl.textContent = formatPrice(subtotal);
  summaryNoteEl.textContent = hasUnavailableItems
    ? "Some cart items are unavailable. They will remain in your cart until you review them."
    : hasStockConflict
      ? "Availability and the final total are confirmed by the store when you place your order."
      : "The store confirms the final total when your order is placed.";
}

async function loadCheckout() {
  showLoading();
  setInlineError("");
  cartItems = cart.getCart();

  if (!cartItems.length) {
    showEmpty();
    return;
  }

  try {
    const auth = await getCurrentUser();
    if (!auth || auth.authenticated === false) {
      showLoginRequired();
      return;
    }

    const products = await Promise.all(
      cartItems.map((item) => getProductById(item.productId))
    );

    productsById = new Map();
    products.forEach((result) => {
      if (result?.success && result.data) {
        productsById.set(Number(result.data.id), result.data);
      }
    });

    renderOrderSummary(cartItems);
    showContent();
  } catch (error) {
    console.error("Failed to load checkout");
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

function getSelectedValue(formElement, fieldName) {
  const field = formElement.elements.namedItem(fieldName);

  return field?.value || "";
}

function selectedPaymentMethod() {
  return getSelectedValue(form, "paymentMethod") || "CASH_ON_DELIVERY";
}

function setPaymentStatus(message) {
  paymentStatusEl.textContent = message;
}

function resetPaymentState(method, provider = null) {
  paymentState = {
    method,
    provider,
    confirmed: method === "CASH_ON_DELIVERY",
    summary: method === "CASH_ON_DELIVERY" ? "Cash on Delivery" : "",
  };
  setPaymentStatus(
    method === "CASH_ON_DELIVERY"
      ? "Pay when your order arrives."
      : "Complete the simulated payment details to continue."
  );
}

function updateProviderVisibility() {
  const method = selectedPaymentMethod();
  cardProviderOptions.hidden = method !== "CARD";
  mobileProviderOptions.hidden = method !== "MOBILE_BANKING";
}

function clearPaymentDialogFields() {
  cardPaymentForm.reset();
  mobilePaymentForm.reset();
  cardPaymentForm.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
  mobilePaymentForm.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
}

function openPaymentDialog(type, provider = null) {
  paymentDialog.hidden = false;
  paymentDialog.setAttribute("aria-hidden", "false");
  cardPaymentForm.hidden = type !== "card";
  mobilePaymentForm.hidden = type !== "mobile";
  clearPaymentDialogFields();
  if (type === "card") {
    paymentDialogTitle.textContent = "Simulated card payment";
    paymentDialogDescription.textContent = "This demo does not process real payments. Your card details are cleared after you confirm and are never sent to the store.";
    if (provider) cardPaymentForm.elements.namedItem("cardProvider").value = provider;
  } else {
    paymentDialogTitle.textContent = "Simulated mobile banking";
    paymentDialogDescription.textContent = "Use a demo mobile number. No PIN, OTP, or banking password is requested or stored.";
    if (provider) mobilePaymentForm.elements.namedItem("mobileProvider").value = provider;
  }
  document.body.classList.add("payment-dialog-open");
  window.setTimeout(() => {
    const firstInput = (type === "card" ? cardPaymentForm : mobilePaymentForm).querySelector("input");
    firstInput?.focus();
  }, 0);
}

function closePaymentDialog() {
  clearPaymentDialogFields();
  paymentDialog.hidden = true;
  paymentDialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("payment-dialog-open");
  dialogReturnFocus?.focus?.();
  dialogReturnFocus = null;
}

function setDialogFieldError(formElement, fieldName, message) {
  const field = formElement.elements.namedItem(fieldName);
  const error = document.getElementById(`${formElement.id}-${fieldName}-error`);
  field?.classList.toggle("invalid", Boolean(message));
  if (field) field.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message || "";
}

function validateCardPayment() {
  const provider = cardPaymentForm.elements.namedItem("cardProvider").value;
  const cardNumber = cardPaymentForm.elements.namedItem("cardNumber").value.replace(/\s+/g, "");
  const cardName = cardPaymentForm.elements.namedItem("cardName").value.trim();
  const expiry = cardPaymentForm.elements.namedItem("cardExpiry").value.trim();
  const cvv = cardPaymentForm.elements.namedItem("cardCvv").value.trim();
  let valid = true;

  if (!provider) valid = false;
  setDialogFieldError(cardPaymentForm, "cardName", cardName ? "" : "Cardholder name is required.");
  if (!cardName) valid = false;
  if (!/^\d{13,19}$/.test(cardNumber) || !passesLuhn(cardNumber)) {
    setDialogFieldError(cardPaymentForm, "cardNumber", "Enter a valid card number.");
    valid = false;
  } else setDialogFieldError(cardPaymentForm, "cardNumber", "");
  if (!isValidExpiry(expiry)) {
    setDialogFieldError(cardPaymentForm, "cardExpiry", "Enter a future expiry date as MM/YY.");
    valid = false;
  } else setDialogFieldError(cardPaymentForm, "cardExpiry", "");
  if (!/^\d{3,4}$/.test(cvv)) {
    setDialogFieldError(cardPaymentForm, "cardCvv", "Enter a valid security code.");
    valid = false;
  } else setDialogFieldError(cardPaymentForm, "cardCvv", "");

  return { valid, provider, lastFour: cardNumber.slice(-4) };
}

function passesLuhn(value) {
  let sum = 0;
  let shouldDouble = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function isValidExpiry(value) {
  const match = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

function validateMobilePayment() {
  const provider = mobilePaymentForm.elements.namedItem("mobileProvider").value;
  const mobileNumber = mobilePaymentForm.elements.namedItem("mobileNumber").value.replace(/\D/g, "");
  let valid = true;
  if (!provider) valid = false;
  if (!/^\d{7,15}$/.test(mobileNumber)) {
    setDialogFieldError(mobilePaymentForm, "mobileNumber", "Enter a valid mobile number.");
    valid = false;
  } else setDialogFieldError(mobilePaymentForm, "mobileNumber", "");
  return { valid, provider };
}

function confirmPaymentSelection() {
  if (selectedPaymentMethod() === "CASH_ON_DELIVERY") {
    paymentState = { method: "CASH_ON_DELIVERY", provider: null, confirmed: true, summary: "Cash on Delivery" };
    setPaymentStatus("Pay when your order arrives.");
    return true;
  }
  if (paymentState.confirmed) return true;
  const message = selectedPaymentMethod() === "CARD" ? "Complete the simulated card details." : "Complete the simulated mobile banking details.";
  setInlineError(message);
  if (selectedPaymentMethod() === "CARD") openPaymentDialog("card", paymentState.provider);
  else openPaymentDialog("mobile", paymentState.provider);
  return false;
}

function buildPaymentPayload() {
  return { method: paymentState.method, provider: paymentState.provider || null };
}

async function handleSubmit(event) {
  event.preventDefault();
  setInlineError("");
  if (submitting) return;
  if (!validateForm()) {
    form.querySelector(".invalid")?.focus();
    return;
  }
  if (!confirmPaymentSelection()) return;

  const latestCart = cart.getCart();
  if (!latestCart.length) {
    showEmpty();
    return;
  }

  setSubmitting(true);
  try {
    const result = await createOrder(latestCart, collectShippingInfo(), buildPaymentPayload());
    if (result?.status === 201 && result?.data?.success) {
      const order = result.data.data?.order;
      if (!order?.id) throw new Error("Missing order ID");
      cart.clearCart();
      window.location.href = `order-details.html?id=${encodeURIComponent(order.id)}`;
      return;
    }
    if (result?.status === 401) {
      showLoginRequired();
      return;
    }
    const message = result?.data?.message || "Unable to place your order. Please try again.";
    setInlineError(message);
    if (result?.status === 409) {
      await loadCheckout();
      if (contentEl.style.display !== "none") setInlineError(message);
    }
  } catch (error) {
    console.error("Checkout request failed");
    setInlineError("Unable to place your order. Please try again.");
  } finally {
    setSubmitting(false);
  }
}

const paymentMethodInputs = getFieldElements(form, "paymentMethod");

paymentMethodInputs.forEach((input) => {
  input.addEventListener("change", (event) => {
    const method = event.target.value;
    resetPaymentState(method);
    updateProviderVisibility();
    setInlineError("");
    if (method === "CARD") openPaymentDialog("card");
    if (method === "MOBILE_BANKING") {
      const provider = getSelectedValue(mobilePaymentForm, "mobileProvider");
      if (provider) openPaymentDialog("mobile", provider);
    }
  });
});

document.addEventListener("change", (event) => {
  if (event.target.name === "cardProvider") {
    paymentState.provider = event.target.value;
    if (!cardPaymentForm.contains(event.target)) openPaymentDialog("card", event.target.value);
  }
  if (event.target.name === "mobileProvider") {
    paymentState.provider = event.target.value;
    if (!mobilePaymentForm.contains(event.target)) openPaymentDialog("mobile", event.target.value);
  }
});

cardPaymentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validateCardPayment();
  if (!result.valid) return;
  paymentState = { method: "CARD", provider: result.provider, confirmed: true, summary: `${result.provider === "VISA" ? "Visa" : "Mastercard"} ending in ${result.lastFour}` };
  setPaymentStatus("Card selection confirmed for this simulated payment.");
  setInlineError("");
  closePaymentDialog();
});

mobilePaymentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validateMobilePayment();
  if (!result.valid) return;
  paymentState = { method: "MOBILE_BANKING", provider: result.provider, confirmed: true, summary: `${result.provider === "BKASH" ? "bKash" : "Nagad"} selected` };
  setPaymentStatus("Mobile banking selection confirmed for this simulated payment.");
  setInlineError("");
  closePaymentDialog();
});

dialogCloseButton.addEventListener("click", closePaymentDialog);
paymentDialog.addEventListener("click", (event) => {
  if (event.target === paymentDialog) closePaymentDialog();
});
document.addEventListener("keydown", (event) => {
  if (paymentDialog.hidden) return;
  if (event.key === "Escape") {
    closePaymentDialog();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...paymentDialog.querySelectorAll("button, input:not([disabled]), [href]")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

requiredFields.forEach((fieldName) => {
  const input = form.elements.namedItem(fieldName);
  if (!input) return;
  input.addEventListener("input", () => clearFieldError(fieldName));
  input.addEventListener("blur", () => clearFieldError(fieldName));
});

form.addEventListener("submit", handleSubmit);
updateProviderVisibility();
document.addEventListener("DOMContentLoaded", loadCheckout);
