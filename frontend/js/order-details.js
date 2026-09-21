import { getOrderById } from "./api.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const notFoundEl = document.getElementById("not-found-state");
const invalidEl = document.getElementById("invalid-state");
const detailsEl = document.getElementById("order-details");

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

function showDetails(order) {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "block";
  renderDetails(order);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function renderDetails(order) {
  detailsEl.innerHTML = "";

  const header = document.createElement("div");
  header.className = "order-details-header";

  const title = document.createElement("h2");
  title.className = "order-details-title";
  title.textContent = `Order #${order.id}`;

  const status = document.createElement("span");
  status.className = "order-status";
  status.textContent = formatStatus(order.status);

  header.appendChild(title);
  header.appendChild(status);

  const meta = document.createElement("div");
  meta.className = "order-details-meta";

  const date = document.createElement("p");
  date.className = "order-date";
  date.textContent = `Date: ${formatDate(order.createdAt)}`;

  const total = document.createElement("p");
  total.className = "order-total";
  total.textContent = `Total: ${formatPrice(order.totalAmount)}`;

  meta.appendChild(date);
  meta.appendChild(total);

  const itemsTitle = document.createElement("h3");
  itemsTitle.className = "order-items-title";
  itemsTitle.textContent = "Items";

  const itemsList = document.createElement("ul");
  itemsList.className = "order-items-list";

  (order.items || []).forEach((item) => {
    const li = document.createElement("li");
    li.className = "order-item";

    const name = document.createElement("p");
    name.className = "order-item-name";
    name.textContent = item.productName;

    const qty = document.createElement("p");
    qty.className = "order-item-qty";
    qty.textContent = `Quantity: ${item.quantity}`;

    const unit = document.createElement("p");
    unit.className = "order-item-price";
    unit.textContent = `Unit Price: ${formatPrice(item.unitPrice)}`;

    const sub = document.createElement("p");
    sub.className = "order-item-subtotal";
    sub.textContent = `Subtotal: ${formatPrice(item.subtotal)}`;

    li.appendChild(name);
    li.appendChild(qty);
    li.appendChild(unit);
    li.appendChild(sub);

    itemsList.appendChild(li);
  });

  const continueBtn = document.createElement("a");
  continueBtn.className = "btn btn-primary";
  continueBtn.href = "products.html";
  continueBtn.textContent = "Continue Shopping";

  detailsEl.appendChild(header);
  detailsEl.appendChild(meta);
  detailsEl.appendChild(itemsTitle);
  detailsEl.appendChild(itemsList);
  detailsEl.appendChild(continueBtn);
}

async function loadOrder() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("id");

  if (!orderId) {
    showInvalid();
    return;
  }

  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    showInvalid();
    return;
  }

  showLoading();

  try {
    const result = await getOrderById(id);

    if (!result.authenticated) {
      // 401 — prompt login
      errorEl.innerHTML = `
        <h2>Please log in</h2>
        <p>You need to be logged in to view order details.</p>`;
      errorEl.style.display = "block";
      loadingEl.style.display = "none";
      notFoundEl.style.display = "none";
      invalidEl.style.display = "none";
      detailsEl.style.display = "none";
      return;
    }

    if (!result.data || !result.data.order) {
      showNotFound();
      return;
    }

    showDetails(result.data.order);
  } catch (error) {
    console.error("Failed to load order:", error);
    showError();
  }
}

document.addEventListener("DOMContentLoaded", loadOrder);