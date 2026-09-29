import {
  getOrderById,
  cancelOrder,
  submitOrderItemRating,
} from "./api.js";

import {
  createStarSelector,
  createStarDisplay,
} from "./stars.js";

const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("order-error-message");
const retryBtn = document.getElementById("retry-order");
const notFoundEl = document.getElementById("not-found-state");
const invalidEl = document.getElementById("invalid-state");
const detailsEl = document.getElementById("order-details");
const actionStatusEl = document.getElementById("order-action-status");

const cancelDialog = document.getElementById("cancel-dialog");
const cancelDialogOrderEl = document.getElementById("cancel-dialog-order");
const cancelDialogClose = document.getElementById("cancel-dialog-close");
const cancelDialogKeep = document.getElementById("cancel-dialog-keep");
const cancelDialogConfirm = document.getElementById("cancel-dialog-confirm");
const cancelForm = document.getElementById("cancel-form");
const cancelReason = document.getElementById("cancel-reason");
const cancelReasonCounter = document.getElementById("cancel-reason-counter");
const cancelReasonError = document.getElementById("cancel-reason-error");
const cancelDialogError = document.getElementById("cancel-dialog-error");

const CANCELLABLE_STATUSES = new Set([
  "pending",
  "confirmed",
  "processing",
]);

const TIMELINE_PATHS = {
  pending: ["pending"],
  confirmed: ["confirmed"],
  processing: ["confirmed", "processing"],
  shipped: ["confirmed", "shipped"],
  delivered: ["confirmed", "shipped", "delivered"],
  completed: ["confirmed", "shipped", "delivered", "completed"],
  cancelled: ["cancelled"],
};

const TIMELINE_LABELS = {
  placed: "Order Placed",
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
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

const CANCEL_REASON_MAX_LENGTH = 500;

let currentOrderId = null;
let currentOrder = null;
let cancelling = false;
let dialogReturnFocus = null;

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

function createTextElement(tag, className, text) {
  return createElement(tag, className, text);
}

function announce(message) {
  actionStatusEl.textContent = message || "";
}

function showLoading() {
  loadingEl.style.display = "block";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
}

function showError(message = null) {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";

  errorMessageEl.textContent =
    message || "We couldn't load this order. Please try again.";

  announce("We couldn't load this order.");
}

function showLoginRequired() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";

  errorEl.replaceChildren(
    createStateIcon("ri-lock-line", "state-icon-warning"),
    createTextElement("h2", null, "Please log in"),
    createTextElement(
      "p",
      null,
      "You need to be logged in to view and manage this order."
    ),
    createActionLink(
      "login.html",
      "ri-login-box-line",
      "Log In",
      "btn btn-primary"
    )
  );

  announce("You need to log in to manage this order.");
}

function createStateIcon(iconClass, wrapperClass) {
  const wrapper = createElement("div", wrapperClass);
  wrapper.appendChild(createIcon(iconClass));
  return wrapper;
}

function createActionLink(href, iconClass, label, className) {
  const link = createElement("a", className);
  link.href = href;
  link.appendChild(createIcon(iconClass));
  link.appendChild(document.createTextNode(` ${label}`));
  return link;
}

function showNotFound() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "block";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";
  announce("This order could not be found.");
}

function showInvalid() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "block";
  detailsEl.style.display = "none";
  announce("The order ID in the URL is not valid.");
}

function showDetails(order) {
  currentOrder = order;

  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "block";

  renderDetails(order);
}

function formatDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
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
    month: options.month || "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

function getNormalizedStatus(order) {
  return String(order.status || "").toLowerCase();
}

function isCancellable(order) {
  return CANCELLABLE_STATUSES.has(getNormalizedStatus(order));
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

function getDeliveryWindowText(order) {
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

function createStatusBadge(order) {
  const normalized = getNormalizedStatus(order);
  const badge = createElement(
    "span",
    `order-status status-${getStatusClass(order.status)}`
  );

  badge.appendChild(
    createIcon(STATUS_ICONS[normalized] || "ri-question-line")
  );
  badge.appendChild(
    document.createTextNode(` ${formatStatus(order.status)}`)
  );

  return badge;
}

function createSection(titleText, className) {
  const section = createElement("section", className);
  const heading = createElement("h2", "order-section-title", titleText);
  section.appendChild(heading);
  return section;
}

function createInfoRow(label, value, valueClass) {
  const row = createElement("div", "order-info-row");
  row.appendChild(createElement("dt", "order-info-label", label));
  row.appendChild(
    createElement("dd", valueClass || "order-info-value", value)
  );
  return row;
}

function createShippingSection(order) {
  const hasShipping = [
    order.shippingName,
    order.shippingAddressLine1,
    order.shippingAddressLine2,
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
    order.shippingCountry,
    order.shippingEmail,
    order.shippingPhone,
  ].some(Boolean);

  if (!hasShipping) {
    return null;
  }

  const section = createSection("Shipping Information", "order-info-card");
  const list = createElement("dl", "order-info-list");

  if (order.shippingName) {
    list.appendChild(
      createInfoRow("Recipient", order.shippingName)
    );
  }

  const addressLines = [
    order.shippingAddressLine1,
    order.shippingAddressLine2,
  ].filter(Boolean);

  if (addressLines.length) {
    list.appendChild(
      createInfoRow("Address", addressLines.join(", "))
    );
  }

  const locality = [
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  if (locality) {
    list.appendChild(createInfoRow("City / Postal code", locality));
  }

  if (order.shippingCountry) {
    list.appendChild(createInfoRow("Country", order.shippingCountry));
  }

  if (order.shippingPhone) {
    list.appendChild(createInfoRow("Phone", order.shippingPhone));
  }

  if (order.shippingEmail) {
    list.appendChild(createInfoRow("Email", order.shippingEmail));
  }

  section.appendChild(list);
  return section;
}

function createTimelineSection(order) {
  const normalized = getNormalizedStatus(order);
  const path = TIMELINE_PATHS[normalized] || [normalized || "pending"];
  const steps = ["placed", ...path];
  const currentIndex = steps.length - 1;

  const section = createSection("Order Timeline", "order-timeline-section");
  const list = createElement("ol", "order-timeline");
  list.setAttribute("aria-label", "Order progress");

  steps.forEach((key, index) => {
    const isCurrent = index === currentIndex;
    const isCancelled = key === "cancelled";
    const item = createElement(
      "li",
      `order-timeline-item${isCurrent ? " is-current" : ""}${
        isCancelled ? " is-cancelled" : ""
      }`
    );

    const marker = createElement("span", "order-timeline-marker");
    marker.appendChild(
      createIcon(
        isCurrent
          ? STATUS_ICONS[key] || "ri-checkbox-circle-line"
          : "ri-check-line"
      )
    );
    marker.setAttribute("aria-hidden", "true");

    const body = createElement("div", "order-timeline-body");
    const label = createElement(
      "span",
      "order-timeline-label",
      TIMELINE_LABELS[key] || formatStatus(key)
    );

    let dateText = null;

    if (key === "placed") {
      dateText = formatDate(order.createdAt);
    } else if (isCancelled) {
      dateText = formatDate(order.cancelledAt);
    }

    if (dateText) {
      const date = createElement("span", "order-timeline-date", dateText);
      body.appendChild(label);
      body.appendChild(date);
    } else {
      body.appendChild(label);

      if (isCurrent) {
        body.appendChild(
          createElement("span", "order-timeline-date", "Current status")
        );
      }
    }

    const stateLabel = createElement("span", "sr-only");
    stateLabel.textContent = isCurrent
      ? " current status"
      : " reached";

    label.appendChild(stateLabel);

    item.appendChild(marker);
    item.appendChild(body);
    list.appendChild(item);
  });

  if (normalized === "cancelled") {
    const note = createElement(
      "p",
      "order-timeline-note",
      "This order is no longer being fulfilled because it was cancelled."
    );
    section.appendChild(list);
    section.appendChild(note);
    return section;
  }

  section.appendChild(list);
  return section;
}

function createDeliverySection(order) {
  const normalized = getNormalizedStatus(order);
  const windowText = getDeliveryWindowText(order);
  const isCancelled = normalized === "cancelled";

  if (!windowText && !isCancelled) {
    return null;
  }

  const section = createSection("Delivery Information", "order-info-card");
  const list = createElement("dl", "order-info-list");

  if (windowText) {
    list.appendChild(
      createInfoRow(
        isCancelled ? "Original estimate" : "Estimated delivery",
        windowText
      )
    );
  }

  if (isCancelled) {
    list.appendChild(
      createInfoRow(
        "Delivery status",
        "Order cancelled — this order is no longer being delivered.",
        "order-info-value order-info-cancelled"
      )
    );
  }

  section.appendChild(list);
  return section;
}

function createPaymentSection(order) {
  const section = createSection("Payment Information", "order-info-card");
  const list = createElement("dl", "order-info-list");

  list.appendChild(
    createInfoRow("Payment method", getPaymentMethodLabel(order))
  );

  const statusRow = createElement("div", "order-info-row");
  statusRow.appendChild(
    createElement("dt", "order-info-label", "Payment status")
  );
  const statusValue = createElement("dd", "order-info-value");
  statusValue.appendChild(
    createElement(
      "span",
      getPaymentStatusClass(order.paymentStatus),
      getPaymentStatusLabel(order.paymentStatus)
    )
  );
  statusRow.appendChild(statusValue);
  list.appendChild(statusRow);

  section.appendChild(list);
  return section;
}

function createCancellationSection(order) {
  const normalized = getNormalizedStatus(order);

  if (normalized !== "cancelled" && !order.cancellationReason) {
    return null;
  }

  const section = createSection("Cancellation", "order-cancellation-card");
  const list = createElement("dl", "order-info-list");

  const cancelledOn =
    formatDateTime(order.cancelledAt) || formatDate(order.cancelledAt);

  if (cancelledOn) {
    list.appendChild(createInfoRow("Cancelled on", cancelledOn));
  }

  if (order.cancellationReason) {
    list.appendChild(
      createInfoRow("Reason", order.cancellationReason)
    );
  }

  section.appendChild(list);

  const note = createElement(
    "p",
    "order-cancellation-note",
    "Payment status above reflects the store's record. No refund is claimed unless the store confirms it."
  );
  section.appendChild(note);

  return section;
}

function createOrderSummarySection(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const section = createSection("Order Summary", "order-summary-card");
  const list = createElement("dl", "order-info-list");

  list.appendChild(
    createInfoRow(
      "Items",
      `${items.length} ${items.length === 1 ? "item" : "items"}`
    )
  );
  list.appendChild(
    createInfoRow(
      "Order total",
      formatPrice(order.totalAmount),
      "order-info-value order-summary-total"
    )
  );

  section.appendChild(list);

  const note = createElement(
    "p",
    "order-summary-note",
    "Prices and totals are the values captured when the order was placed."
  );
  section.appendChild(note);

  return section;
}

function createRatingSection(order, item) {
  const section = createElement("div", "rating-section");
  const label = createElement("p", "rating-label", "Your Rating");

  section.appendChild(label);

  const hasRating =
    item.rating !== null && item.rating !== undefined;

  const isCompleted = getNormalizedStatus(order) === "completed";

  if (hasRating) {
    renderRatedState(section, item.rating);
    return section;
  }

  if (!isCompleted) {
    const status = createElement(
      "p",
      "rating-status",
      "Rating available after order completion."
    );

    section.appendChild(status);
    return section;
  }

  createInteractiveRating(section, order, item);
  return section;
}

function renderRatedState(section, rating) {
  const stars = createStarDisplay(Number(rating));
  stars.classList.add("rated-display");
  section.appendChild(stars);

  const status = createElement("p", "rating-status", "Rated");
  section.appendChild(status);
}

function createInteractiveRating(section, order, item) {
  const selector = createStarSelector(0);
  selector.id = `rating-selector-${item.id}`;
  section.appendChild(selector);

  const submitBtn = createElement("button", "btn btn-rating", "Submit Rating");
  submitBtn.type = "button";
  submitBtn.disabled = true;
  section.appendChild(submitBtn);

  const messageEl = createElement("p", "rating-message");
  messageEl.setAttribute("role", "status");
  messageEl.setAttribute("aria-live", "polite");
  section.appendChild(messageEl);

  let selectedRating = 0;

  selector.addEventListener("star-select", (event) => {
    selectedRating = Number(event.detail?.value || 0);
    submitBtn.disabled = selectedRating < 1;
  });

  submitBtn.addEventListener("click", async () => {
    if (selectedRating < 1 || submitBtn.disabled) {
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    messageEl.textContent = "";
    messageEl.classList.remove("error");

    try {
      const result = await submitOrderItemRating(
        order.id,
        item.id,
        selectedRating
      );

      if (result?.status === 200 && result?.data?.success) {
        const rating = result.data.data?.rating ?? selectedRating;
        section.replaceChildren();

        const label = createElement("p", "rating-label", "Your Rating");
        section.appendChild(label);
        renderRatedState(section, rating);
        announce("Your rating was submitted.");
        return;
      }

      messageEl.textContent =
        result?.data?.message || "Failed to submit rating.";
      messageEl.classList.add("error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Rating";
    } catch (error) {
      console.error("Rating submission error:", error);
      messageEl.textContent =
        "Something went wrong. Please try again.";
      messageEl.classList.add("error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Rating";
    }
  });
}

function createOrderItem(order, item) {
  const li = createElement("li", "order-item");

  li.appendChild(
    createElement(
      "p",
      "order-item-name",
      item.productName || `Product #${item.productId}`
    )
  );
  li.appendChild(
    createElement("p", "order-item-qty", `Quantity: ${item.quantity}`)
  );
  li.appendChild(
    createElement(
      "p",
      "order-item-price",
      `Unit price: ${formatPrice(item.unitPrice)}`
    )
  );
  li.appendChild(
    createElement(
      "p",
      "order-item-subtotal",
      `Subtotal: ${formatPrice(item.subtotal)}`
    )
  );

  li.appendChild(createRatingSection(order, item));
  return li;
}

function createOrderItemsSection(order) {
  const section = createSection("Ordered Items", "order-items-section");
  const list = createElement("ul", "order-items-list");
  const items = Array.isArray(order.items) ? order.items : [];

  if (items.length === 0) {
    list.appendChild(
      createElement(
        "li",
        "order-item",
        "No items were found for this order."
      )
    );
  } else {
    items.forEach((item) => {
      list.appendChild(createOrderItem(order, item));
    });
  }

  section.appendChild(list);
  return section;
}

function createActionsSection(order) {
  const actions = createElement("div", "order-details-actions");

  if (isCancellable(order)) {
    const cancelBtn = createElement("button", "btn btn-cancel");
    cancelBtn.type = "button";
    cancelBtn.id = "cancel-order-btn";
    cancelBtn.appendChild(createIcon("ri-close-circle-line"));
    cancelBtn.appendChild(
      document.createTextNode(" Cancel Order")
    );
    cancelBtn.addEventListener("click", () => openCancelDialog(order));
    actions.appendChild(cancelBtn);
  }

  const continueBtn = createActionLink(
    "products.html",
    "ri-arrow-right-line",
    "Continue Shopping",
    "btn btn-primary"
  );
  actions.appendChild(continueBtn);

  return actions;
}

function renderDetails(order) {
  detailsEl.replaceChildren();

  const header = createElement("div", "order-details-header");
  const headerText = createElement("div", "order-details-header-text");
  headerText.appendChild(
    createElement("h1", "order-details-title", `Order #${order.id}`)
  );
  const placed = formatDate(order.createdAt);
  headerText.appendChild(
    createElement(
      "p",
      "order-details-placed",
      placed ? `Placed on ${placed}` : "Placement date not available"
    )
  );
  header.appendChild(headerText);
  header.appendChild(createStatusBadge(order));

  const meta = createElement("div", "order-details-meta");
  const placedCard = createElement("div", "order-meta-card");
  placedCard.appendChild(
    createElement("span", "order-meta-label", "Order total")
  );
  placedCard.appendChild(
    createElement(
      "strong",
      "order-meta-total",
      formatPrice(order.totalAmount)
    )
  );
  meta.appendChild(placedCard);

  const windowText = getDeliveryWindowText(order);
  if (windowText) {
    const deliveryCard = createElement("div", "order-meta-card");
    deliveryCard.appendChild(
      createElement("span", "order-meta-label", "Estimated delivery")
    );
    deliveryCard.appendChild(
      createElement("strong", "order-meta-value", windowText)
    );
    meta.appendChild(deliveryCard);
  }

  detailsEl.appendChild(header);
  detailsEl.appendChild(meta);
  detailsEl.appendChild(createTimelineSection(order));

  const infoGrid = createElement("div", "order-info-grid");
  const deliverySection = createDeliverySection(order);
  if (deliverySection) infoGrid.appendChild(deliverySection);
  infoGrid.appendChild(createPaymentSection(order));
  const shippingSection = createShippingSection(order);
  if (shippingSection) infoGrid.appendChild(shippingSection);
  detailsEl.appendChild(infoGrid);

  detailsEl.appendChild(createOrderItemsSection(order));
  detailsEl.appendChild(createOrderSummarySection(order));

  const cancellationSection = createCancellationSection(order);
  if (cancellationSection) {
    detailsEl.appendChild(cancellationSection);
  }

  detailsEl.appendChild(createActionsSection(order));

  announce(
    `Order ${order.id} loaded. Status ${formatStatus(order.status)}.`
  );
}

function setCancelSubmitting(isSubmitting) {
  cancelling = isSubmitting;
  cancelDialogConfirm.disabled = isSubmitting;
  cancelDialogKeep.disabled = isSubmitting;
  cancelDialogClose.disabled = isSubmitting;

  const text = cancelDialogConfirm.querySelector(".btn-text");
  const loading = cancelDialogConfirm.querySelector(".btn-loading");

  text.style.display = isSubmitting ? "none" : "inline-flex";
  loading.style.display = isSubmitting ? "inline-flex" : "none";
}

function setCancelDialogError(message) {
  cancelDialogError.textContent = message || "";
  cancelDialogError.hidden = !message;
}

function updateReasonCounter() {
  cancelReasonCounter.textContent = `${cancelReason.value.length} / ${CANCEL_REASON_MAX_LENGTH}`;
}

function validateCancelReason() {
  const value = cancelReason.value.trim();
  const tooLong = value.length > CANCEL_REASON_MAX_LENGTH;

  cancelReason.classList.toggle("invalid", tooLong);
  cancelReason.setAttribute("aria-invalid", String(tooLong));
  cancelReasonError.textContent = tooLong
    ? "Please keep the reason under 500 characters."
    : "";

  return !tooLong;
}

function openCancelDialog(order) {
  dialogReturnFocus = document.activeElement;
  cancelDialogOrderEl.textContent = `Order #${order.id}`;

  cancelForm.reset();
  cancelReasonError.textContent = "";
  cancelReason.classList.remove("invalid");
  cancelReason.setAttribute("aria-invalid", "false");
  setCancelDialogError("");
  updateReasonCounter();
  setCancelSubmitting(false);

  cancelDialog.hidden = false;
  cancelDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("order-dialog-open");

  window.setTimeout(() => {
    cancelDialogKeep.focus();
  }, 0);
}

function closeCancelDialog() {
  if (cancelling) return;

  cancelDialog.hidden = true;
  cancelDialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("order-dialog-open");

  dialogReturnFocus?.focus?.();
  dialogReturnFocus = null;
}

async function refreshOrder({ silent = false } = {}) {
  try {
    const result = await getOrderById(currentOrderId);

    if (!result || result.authenticated === false) {
      showLoginRequired();
      return null;
    }

    if (!result.data?.order) {
      showNotFound();
      return null;
    }

    showDetails(result.data.order);

    if (silent) {
      announce(
        `Order ${currentOrderId} refreshed. Status ${formatStatus(
          currentOrder?.status
        )}.`
      );
    }

    return result.data.order;
  } catch (error) {
    console.error("Failed to refresh order:", error);
    showError();
    return null;
  }
}

async function handleCancelSubmit(event) {
  event.preventDefault();

  if (cancelling || !currentOrder) return;

  setCancelDialogError("");

  if (!validateCancelReason()) {
    cancelReason.focus();
    return;
  }

  const reason = cancelReason.value.trim() || null;

  setCancelSubmitting(true);
  announce("Cancelling your order.");

  try {
    const result = await cancelOrder(currentOrderId, reason);

    if (result?.status === 200 && result?.data?.success) {
      const order = result?.data?.data?.order;
      const alreadyCancelled = Boolean(
        result?.data?.data?.already_cancelled
      );

      setCancelSubmitting(false);
      closeCancelDialog();

      if (order) {
        showDetails(order);
      } else {
        await refreshOrder();
      }

      announce(
        alreadyCancelled
          ? "This order was already cancelled."
          : "Order cancelled."
      );
      return;
    }

    if (result?.status === 401) {
      setCancelSubmitting(false);
      closeCancelDialog();
      showLoginRequired();
      return;
    }

    if (result?.status === 404) {
      setCancelSubmitting(false);
      closeCancelDialog();
      showNotFound();
      announce("This order could not be found.");
      return;
    }

    if (result?.status === 409) {
      setCancelSubmitting(false);
      setCancelDialogError(
        "This order can no longer be cancelled. Refreshing the order status."
      );
      announce("This order can no longer be cancelled.");

      const refreshed = await refreshOrder({ silent: true });

      if (!refreshed || !isCancellable(refreshed)) {
        cancelDialogConfirm.disabled = true;
        cancelDialogKeep.focus();
      }

      return;
    }

    if (result?.status === 400) {
      setCancelSubmitting(false);
      setCancelDialogError(
        result?.data?.message ||
          "We couldn't accept that cancellation reason. Please review it and try again."
      );
      return;
    }

    setCancelSubmitting(false);
    setCancelDialogError(
      "We couldn't cancel the order right now. Please try again."
    );
    announce("We couldn't cancel the order right now.");
  } catch (error) {
    console.error("Cancellation request failed:", error);
    setCancelSubmitting(false);
    setCancelDialogError(
      "We couldn't cancel the order right now. Please try again."
    );
    announce("We couldn't cancel the order right now.");
  }
}

function handleDialogKeydown(event) {
  if (cancelDialog.hidden) return;

  if (event.key === "Escape") {
    closeCancelDialog();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = [
    ...cancelDialog.querySelectorAll(
      "button:not([disabled]), textarea:not([disabled]), [href]"
    ),
  ];

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

  currentOrderId = id;

  showLoading();
  announce("Loading your order.");

  try {
    const result = await getOrderById(id);

    if (!result || result.authenticated === false) {
      showLoginRequired();
      return;
    }

    if (!result.data?.order) {
      showNotFound();
      return;
    }

    showDetails(result.data.order);
  } catch (error) {
    console.error("Failed to load order:", error);
    showError();
  }
}

cancelReason.addEventListener("input", () => {
  updateReasonCounter();
  if (cancelReasonError.textContent) {
    validateCancelReason();
  }
});

cancelForm.addEventListener("submit", handleCancelSubmit);
cancelDialogClose.addEventListener("click", closeCancelDialog);
cancelDialogKeep.addEventListener("click", closeCancelDialog);

cancelDialog.addEventListener("click", (event) => {
  if (event.target === cancelDialog) {
    closeCancelDialog();
  }
});

document.addEventListener("keydown", handleDialogKeydown);
retryBtn?.addEventListener("click", () => loadOrder());
document.addEventListener("DOMContentLoaded", () => loadOrder());
