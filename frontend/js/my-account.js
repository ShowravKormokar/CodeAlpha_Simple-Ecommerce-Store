import { getCurrentUser, logoutUser, getOrders } from "./api.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const unauthorizedEl = document.getElementById("unauthorized-state");
const contentEl = document.getElementById("account-content");

const profileNameEl = document.getElementById("profile-name");
const profileEmailEl = document.getElementById("profile-email");
const profileMemberSinceEl = document.getElementById("profile-member-since");
const logoutBtn = document.getElementById("logout-btn");

const totalOrdersEl = document.getElementById("total-orders");
const completedOrdersEl = document.getElementById("completed-orders");
const cancelledOrdersEl = document.getElementById("cancelled-orders");
const pendingOrdersEl = document.getElementById("pending-orders");

const ordersTbody = document.getElementById("orders-tbody");
const ordersEmptyEl = document.getElementById("orders-empty");
const ordersTable = document.getElementById("orders-table");

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}

function showLoading() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  unauthorizedEl.style.display = "none";
  contentEl.style.display = "none";
}

function showError(message) {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  unauthorizedEl.style.display = "none";
  contentEl.style.display = "none";
  errorMessageEl.textContent = message;
}

function showUnauthorized() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  unauthorizedEl.style.display = "block";
  contentEl.style.display = "none";
}

function showContent() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  unauthorizedEl.style.display = "none";
  contentEl.style.display = "block";
}

async function loadAccount() {
  showLoading();

  try {
    const result = await getCurrentUser();

    if (!result.authenticated) {
      showUnauthorized();
      return;
    }

    const user = result.data.user;
    if (!user) {
      showError("User data not found.");
      return;
    }

    // Update profile
    profileNameEl.textContent = user.name || "User";
    profileEmailEl.textContent = user.email || "No email";
    profileMemberSinceEl.textContent = `Member since: ${formatDate(user.created_at)}`;

    // Load orders for analytics and history
    await loadOrders();

    showContent();
  } catch (error) {
    console.error("Failed to load account:", error);
    showError("Unable to load account. Please try again.");
  }
}

async function loadOrders() {
  try {
    const result = await getOrders();

    if (!result.authenticated) {
      // Show empty state for orders
      ordersTable.style.display = "none";
      ordersEmptyEl.style.display = "block";
      ordersEmptyEl.innerHTML = "<p>Please log in to view orders.</p>";
      return;
    }

    const orders = result.data.orders || [];

    // Calculate analytics
    const total = orders.length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const pending = orders.filter((o) => o.status === "pending").length;

    totalOrdersEl.textContent = total;
    completedOrdersEl.textContent = completed;
    cancelledOrdersEl.textContent = cancelled;
    pendingOrdersEl.textContent = pending;

    // Render order history (show latest 5)
    if (orders.length === 0) {
      ordersTable.style.display = "none";
      ordersEmptyEl.style.display = "block";
    } else {
      ordersTable.style.display = "table";
      ordersEmptyEl.style.display = "none";

      const displayOrders = orders.slice(0, 5);
      ordersTbody.innerHTML = displayOrders
        .map(
          (order) => `
        <tr>
          <td><a href="order-details.html?id=${order.id}">#${order.id}</a></td>
          <td>${formatDate(order.createdAt)}</td>
          <td><span class="status-badge status-${order.status}">${formatStatus(order.status)}</span></td>
          <td>${formatPrice(order.totalAmount)}</td>
          <td><a class="btn btn-secondary btn-sm" href="order-details.html?id=${order.id}">View</a></td>
        </tr>
      `
        )
        .join("");
    }
  } catch (error) {
    console.error("Failed to load orders:", error);
    ordersTable.style.display = "none";
    ordersEmptyEl.style.display = "block";
    ordersEmptyEl.innerHTML = "<p>Unable to load orders.</p>";
  }
}

async function handleLogout() {
  logoutBtn.disabled = true;
  logoutBtn.innerHTML = '<i class="ri-loader-4-line" aria-hidden="true"></i> Logging out...';

  try {
    await logoutUser();
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout failed:", error);
    alert("Logout failed. Please try again.");
    logoutBtn.disabled = false;
    logoutBtn.innerHTML = '<i class="ri-logout-box-r-line" aria-hidden="true"></i> Logout';
  }
}

logoutBtn.addEventListener("click", handleLogout);

document.addEventListener("DOMContentLoaded", loadAccount);