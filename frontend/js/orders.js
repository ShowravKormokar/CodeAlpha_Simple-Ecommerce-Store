import { getOrders } from "./api.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const emptyEl = document.getElementById("empty-state");
const ordersList = document.getElementById("orders-list");
const retryBtn = document.getElementById("retry-orders");

function showLoading() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  ordersList.style.display = "none";
}

function showError(message = null) {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  ordersList.style.display = "none";

  if (message) {
    errorEl.innerHTML = `
      <div class="state-icon state-icon-error">
        <i class="ri-error-warning-line" aria-hidden="true"></i>
      </div>

      <h2>Unable to load orders</h2>

      <p>${escapeHtml(message)}</p>

      <button
        class="btn btn-secondary"
        id="retry-orders"
        type="button"
      >
        <i class="ri-refresh-line" aria-hidden="true"></i>
        Try Again
      </button>
    `;

    document
      .getElementById("retry-orders")
      ?.addEventListener("click", loadOrders);
  }
}

function showLoginRequired() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  ordersList.style.display = "none";

  errorEl.innerHTML = `
    <div class="state-icon state-icon-warning">
      <i class="ri-lock-line" aria-hidden="true"></i>
    </div>

    <h2>Please log in</h2>

    <p>
      You need to be logged in to view your order history.
    </p>

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
  ordersList.style.display = "none";
}

function showOrders(orders) {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  ordersList.style.display = "flex";

  renderOrders(orders);
}

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return status
    .toString()
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrice(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function getStatusClass(status) {
  return String(status || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function renderOrders(orders) {
  ordersList.innerHTML = "";

  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = "order-card";

    const header = document.createElement("div");
    header.className = "order-header";

    const title = document.createElement("h3");
    title.className = "order-title";
    title.textContent = `Order #${order.id}`;

    const status = document.createElement("span");
    status.className = `order-status status-${getStatusClass(order.status)}`;
    status.textContent = formatStatus(order.status);

    header.appendChild(title);
    header.appendChild(status);


    const details = document.createElement("div");
    details.className = "order-details-row";

    const date = document.createElement("p");
    date.className = "order-date";
    date.innerHTML = `
      <i class="ri-calendar-line" aria-hidden="true"></i>
      ${escapeHtml(formatDate(order.createdAt))}
    `;

    const total = document.createElement("p");
    total.className = "order-total";
    total.textContent = formatPrice(order.totalAmount);

    details.appendChild(date);
    details.appendChild(total);


    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = `order-details.html?id=${encodeURIComponent(order.id)}`;
    link.innerHTML = `
      View Details
      <i class="ri-arrow-right-line" aria-hidden="true"></i>
    `;


    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(link);

    ordersList.appendChild(card);
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

async function loadOrders() {
  showLoading();

  try {
    const result = await getOrders();

    if (!result || result.authenticated === false) {
      showLoginRequired();
      return;
    }

    if (!result.success && result.status && result.status >= 400) {
      if (result.status === 401) {
        showLoginRequired();
      } else {
        showError(result.data?.message || "Unable to load your orders.");
      }

      return;
    }

    const orders =
      result.data?.orders ??
      result.data?.data?.orders ??
      [];

    if (!Array.isArray(orders) || orders.length === 0) {
      showEmpty();
      return;
    }

    showOrders(orders);
  } catch (error) {
    console.error("Failed to load orders:", error);
    showError();
  }
}

retryBtn?.addEventListener("click", loadOrders);

document.addEventListener("DOMContentLoaded", loadOrders);