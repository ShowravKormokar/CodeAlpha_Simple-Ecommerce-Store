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

function showError() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  ordersList.style.display = "none";
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
  ordersList.style.display = "block";
  renderOrders(orders);
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
    status.className = "order-status";
    status.textContent = formatStatus(order.status);

    header.appendChild(title);
    header.appendChild(status);

    const details = document.createElement("div");
    details.className = "order-details-row";

    const date = document.createElement("p");
    date.className = "order-date";
    date.textContent = `Date: ${formatDate(order.createdAt)}`;

    const total = document.createElement("p");
    total.className = "order-total";
    total.textContent = `Total: ${formatPrice(order.totalAmount)}`;

    details.appendChild(date);
    details.appendChild(total);

    const link = document.createElement("a");
    link.className = "btn btn-primary";
    link.href = `order-details.html?id=${order.id}`;
    link.textContent = "View Details";

    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(link);

    ordersList.appendChild(card);
  });
}

async function loadOrders() {
  showLoading();

  try {
    const result = await getOrders();

    if (!result.authenticated) {
      // 401 — prompt login
      errorEl.innerHTML = `
        <h2>Please log in</h2>
        <p>You need to be logged in to view your orders.</p>`;
      errorEl.style.display = "block";
      loadingEl.style.display = "none";
      emptyEl.style.display = "none";
      ordersList.style.display = "none";
      return;
    }

    const orders = result.data && result.data.orders ? result.data.orders : [];

    if (orders.length === 0) {
      showEmpty();
      return;
    }

    showOrders(orders);
  } catch (error) {
    console.error("Failed to load orders:", error);
    showError();
  }
}

retryBtn.addEventListener("click", loadOrders);

document.addEventListener("DOMContentLoaded", loadOrders);