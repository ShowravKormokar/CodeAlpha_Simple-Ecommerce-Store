import { getOrders } from "./api.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("orders-error-message");
const emptyEl = document.getElementById("empty-state");
const ordersList = document.getElementById("orders-list");
const retryBtn = document.getElementById("retry-orders");
const statusEl = document.getElementById("orders-status");

const PAYMENT_METHOD_LABELS = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  CARD: "Card",
  MOBILE_BANKING: "Mobile Banking",
};

const PAYMENT_PROVIDER_LABELS = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  BKASH: "bKash",
  NAGAD: "Nagad",
};

const STATUS_ICONS = {
  pending: "ri-time-line",
  confirmed: "ri-checkbox-circle-line",
  processing: "ri-settings-3-line",
  shipped: "ri-truck-line",
  delivered: "ri-box-line",
  completed: "ri-check-double-line",
  cancelled: "ri-close-circle-line",
};

function announce(message) {
  statusEl.textContent = message || "";
}

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

  errorMessageEl.textContent =
    message || "We couldn't load your orders. Please try again.";

  announce("We couldn't load your orders.");
}

function showLoginRequired() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  emptyEl.style.display = "none";
  ordersList.style.display = "none";

  errorEl.replaceChildren(
    createStateIcon("ri-lock-line", "state-icon-warning"),
    createHeading("Please log in"),
    createText(
      "You need to be logged in to view your order history."
    ),
    createActionLink(
      "login.html",
      "ri-login-box-line",
      "Log In",
      "btn btn-primary"
    )
  );

  announce("You need to log in to view your orders.");
}

function showEmpty() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "block";
  ordersList.style.display = "none";
  announce("You have no orders yet.");
}

function showOrders(orders) {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  ordersList.style.display = "flex";

  renderOrders(orders);
  announce(
    `${orders.length} ${orders.length === 1 ? "order" : "orders"} loaded.`
  );
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null) {
    element.textContent = text;
  }

  return element;
}

function createIcon(iconClass) {
  const icon = document.createElement("i");
  icon.className = iconClass;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createStateIcon(iconClass, wrapperClass) {
  const wrapper = createElement("div", wrapperClass);
  wrapper.appendChild(createIcon(iconClass));
  return wrapper;
}

function createHeading(text) {
  return createElement("h2", null, text);
}

function createText(text) {
  return createElement("p", null, text);
}

function createActionLink(href, iconClass, label, className) {
  const link = createElement("a", className);
  link.href = href;
  link.appendChild(createIcon(iconClass));
  link.appendChild(document.createTextNode(` ${label}`));
  return link;
}

function formatDate(value, options = { month: "short" }) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: options.month,
    day: "numeric",
  });
}

function parseDateOnly(value) {
  if (typeof value !== "string") return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return null;

  const parsed = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateOnly(value, options = {}) {
  const date = parseDateOnly(value);

  if (!date) return null;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  });
}

function formatStatus(status) {
  if (!status) return "Unknown";

  return String(status)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrice(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusClass(status) {
  return String(status || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function getPaymentMethodLabel(order) {
  if (!order.paymentMethod) return "Not recorded";

  const method = PAYMENT_METHOD_LABELS[order.paymentMethod] || "Unknown";
  const provider = order.paymentProvider
    ? PAYMENT_PROVIDER_LABELS[order.paymentProvider]
    : null;

  return provider ? `${method} · ${provider}` : method;
}

function getPaymentStatusLabel(status) {
  if (!status) return "Not recorded";

  return String(status)
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getPaymentStatusClass(status) {
  return `payment-status payment-status--${String(status || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

function formatDeliveryRange(fromValue, toValue) {
  const fromDate = parseDateOnly(fromValue);
  const toDate = parseDateOnly(toValue);

  if (!fromDate || !toDate) return null;

  const year = toDate.getUTCFullYear();
  const sameYear = fromDate.getUTCFullYear() === year;
  const sameMonth = sameYear && fromDate.getUTCMonth() === toDate.getUTCMonth();
  const start = fromDate.toLocaleDateString("en-US", {
    year: sameMonth ? undefined : "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const end = toDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: sameYear ? undefined : "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${start} – ${end}`;
}

function createDeliveryWindowText(order) {
  const range = formatDeliveryRange(
    order.estimatedDeliveryFrom,
    order.estimatedDeliveryTo
  );
  const from = formatDateOnly(order.estimatedDeliveryFrom);
  const to = formatDateOnly(order.estimatedDeliveryTo);

  if (range) return range;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return null;
}

function createStatusBadge(status) {
  const normalized = String(status || "unknown").toLowerCase();
  const badge = createElement(
    "span",
    `order-status status-${getStatusClass(status)}`
  );

  badge.appendChild(
    createIcon(STATUS_ICONS[normalized] || "ri-question-line")
  );
  badge.appendChild(
    document.createTextNode(` ${formatStatus(status)}`)
  );

  return badge;
}

function createMetaItem(label, value, valueClass) {
  const wrapper = createElement("div", "order-meta-item");
  const labelEl = createElement("span", "order-meta-label", label);
  const valueEl = createElement("span", valueClass, value);

  wrapper.appendChild(labelEl);
  wrapper.appendChild(valueEl);

  return wrapper;
}

function renderOrders(orders) {
  ordersList.replaceChildren();

  orders.forEach((order) => {
    const card = createElement("article", "order-card");

    const header = createElement("div", "order-header");
    const title = createElement("h3", "order-title", `Order #${order.id}`);
    header.appendChild(title);
    header.appendChild(createStatusBadge(order.status));

    const meta = createElement("div", "order-card-meta");

    meta.appendChild(
      createMetaItem(
        "Placed",
        formatDate(order.createdAt) || "Unknown",
        "order-meta-value"
      )
    );

    meta.appendChild(
      createMetaItem(
        "Total",
        formatPrice(order.totalAmount),
        "order-meta-value order-meta-total"
      )
    );

    meta.appendChild(
      createMetaItem(
        "Payment",
        getPaymentMethodLabel(order),
        "order-meta-value"
      )
    );

    const paymentStatus = createElement(
      "span",
      getPaymentStatusClass(order.paymentStatus),
      getPaymentStatusLabel(order.paymentStatus)
    );
    const paymentStatusItem = createElement("div", "order-meta-item");
    paymentStatusItem.appendChild(
      createElement("span", "order-meta-label", "Payment status")
    );
    paymentStatusItem.appendChild(paymentStatus);
    meta.appendChild(paymentStatusItem);

    const deliveryText = createDeliveryWindowText(order);
    if (deliveryText) {
      meta.appendChild(
        createMetaItem(
          String(order.status).toLowerCase() === "cancelled"
            ? "Original delivery"
            : "Estimated delivery",
          deliveryText,
          "order-meta-value"
        )
      );
    }

    card.appendChild(header);
    card.appendChild(meta);

    if (String(order.status).toLowerCase() === "cancelled") {
      const note = createElement("p", "order-card-note");
      const cancelledOn = formatDate(order.cancelledAt, { month: "long" });
      note.appendChild(createIcon("ri-information-line"));
      note.appendChild(
        document.createTextNode(
          cancelledOn
            ? ` Order cancelled on ${cancelledOn}.`
            : " Order cancelled."
        )
      );
      card.appendChild(note);
    }

    const link = createActionLink(
      `order-details.html?id=${encodeURIComponent(order.id)}`,
      "ri-arrow-right-line",
      "View Details",
      "btn btn-primary order-card-link"
    );

    card.appendChild(link);
    ordersList.appendChild(card);
  });
}

async function loadOrders() {
  showLoading();
  announce("Loading your orders.");

  try {
    const result = await getOrders();

    if (!result || result.authenticated === false) {
      showLoginRequired();
      return;
    }

    const orders = Array.isArray(result.data?.orders)
      ? result.data.orders
      : [];

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

retryBtn?.addEventListener("click", loadOrders);

document.addEventListener("DOMContentLoaded", loadOrders);
