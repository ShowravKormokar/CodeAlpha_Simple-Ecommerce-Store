import {
  getOrderById,
  submitOrderItemRating,
} from "./api.js";

import {
  createStarSelector,
  createStarDisplay,
} from "./stars.js";


const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-state");
const notFoundEl = document.getElementById("not-found-state");
const invalidEl = document.getElementById("invalid-state");
const detailsEl = document.getElementById("order-details");


/* =========================================================
   PAGE STATES
   ========================================================= */

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

  if (message) {
    errorEl.innerHTML = `
      <div class="state-icon state-icon-error">
        <i class="ri-error-warning-line" aria-hidden="true"></i>
      </div>

      <h2>Unable to load order</h2>

      <p>${escapeHtml(message)}</p>

      <a class="btn btn-secondary" href="orders.html">
        <i class="ri-arrow-left-line" aria-hidden="true"></i>
        Back to Orders
      </a>
    `;
  }
}

function showLoginRequired() {
  loadingEl.style.display = "none";
  errorEl.style.display = "block";
  notFoundEl.style.display = "none";
  invalidEl.style.display = "none";
  detailsEl.style.display = "none";

  errorEl.innerHTML = `
    <div class="state-icon state-icon-warning">
      <i class="ri-lock-line" aria-hidden="true"></i>
    </div>

    <h2>Please log in</h2>

    <p>
      You need to be logged in to view order details.
    </p>

    <a class="btn btn-primary" href="login.html">
      <i class="ri-login-box-line" aria-hidden="true"></i>
      Log In
    </a>
  `;
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


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatDate(dateString) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatus(status) {
  if (!status) {
    return "Unknown";
  }

  return String(status)
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

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}


/* =========================================================
   SHIPPING
   ========================================================= */

function createShippingSection(order) {
  if (!order.shippingName && !order.shippingAddressLine1) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "order-shipping";

  const title = document.createElement("h3");
  title.className = "order-shipping-title";
  title.textContent = "Shipping Address";

  section.appendChild(title);


  const lines = [];

  if (order.shippingName) {
    lines.push(order.shippingName);
  }

  if (order.shippingAddressLine1) {
    lines.push(order.shippingAddressLine1);
  }

  if (order.shippingAddressLine2) {
    lines.push(order.shippingAddressLine2);
  }

  const cityStatePostal = [
    order.shippingCity,
    order.shippingState,
    order.shippingPostalCode,
  ]
    .filter(Boolean)
    .join(", ");

  if (cityStatePostal) {
    lines.push(cityStatePostal);
  }

  if (order.shippingCountry) {
    lines.push(order.shippingCountry);
  }


  lines.forEach((line) => {
    const lineEl = document.createElement("p");
    lineEl.className = "order-shipping-line";
    lineEl.textContent = line;

    section.appendChild(lineEl);
  });


  if (order.shippingEmail || order.shippingPhone) {
    const contactEl = document.createElement("p");
    contactEl.className = "order-shipping-contact";

    const contactParts = [];

    if (order.shippingEmail) {
      contactParts.push(order.shippingEmail);
    }

    if (order.shippingPhone) {
      contactParts.push(order.shippingPhone);
    }

    contactEl.textContent = contactParts.join(" · ");

    section.appendChild(contactEl);
  }

  return section;
}


/* =========================================================
   RATING
   ========================================================= */

function createRatingSection(order, item) {
  const section = document.createElement("div");
  section.className = "rating-section";

  const label = document.createElement("p");
  label.className = "rating-label";
  label.textContent = "Your Rating";

  section.appendChild(label);


  const hasRating =
    item.rating !== null &&
    item.rating !== undefined;


  const isCompleted =
    String(order.status).toLowerCase() === "completed";


  if (hasRating) {
    renderRatedState(section, item.rating);
    return section;
  }


  if (!isCompleted) {
    const status = document.createElement("p");
    status.className = "rating-status";
    status.textContent =
      "Rating available after order completion.";

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


  const status = document.createElement("p");
  status.className = "rating-status";
  status.textContent = "Rated";

  section.appendChild(status);
}


function createInteractiveRating(section, order, item) {
  const selector = createStarSelector(0);

  selector.id = `rating-selector-${item.id}`;

  section.appendChild(selector);


  const submitBtn = document.createElement("button");

  submitBtn.type = "button";
  submitBtn.className = "btn btn-rating";
  submitBtn.textContent = "Submit Rating";
  submitBtn.disabled = true;


  const messageEl = document.createElement("p");

  messageEl.className = "rating-message";


  let selectedRating = 0;


  selector.addEventListener("star-select", (event) => {
    selectedRating = Number(event.detail?.value || 0);

    submitBtn.disabled = selectedRating < 1;
  });


  submitBtn.addEventListener("click", async () => {
    if (selectedRating < 1) {
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

      if (
        result?.status === 200 &&
        result?.data?.success
      ) {
        const rating =
          result.data.data?.rating ??
          selectedRating;

        section.innerHTML = "";

        const label = document.createElement("p");
        label.className = "rating-label";
        label.textContent = "Your Rating";

        section.appendChild(label);

        renderRatedState(section, rating);

        return;
      }


      messageEl.textContent =
        result?.data?.message ||
        "Failed to submit rating.";

      messageEl.classList.add("error");

      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Rating";

    } catch (error) {
      console.error(
        "Rating submission error:",
        error
      );

      messageEl.textContent =
        "Something went wrong. Please try again.";

      messageEl.classList.add("error");

      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Rating";
    }
  });


  section.appendChild(submitBtn);
  section.appendChild(messageEl);
}


/* =========================================================
   ORDER ITEMS
   ========================================================= */

function createOrderItem(order, item) {
  const li = document.createElement("li");

  li.className = "order-item";


  const name = document.createElement("p");

  name.className = "order-item-name";

  name.textContent =
    item.productName ||
    `Product #${item.productId}`;


  const quantity = document.createElement("p");

  quantity.className = "order-item-qty";

  quantity.textContent =
    `Quantity: ${item.quantity}`;


  const unitPrice = document.createElement("p");

  unitPrice.className = "order-item-price";

  unitPrice.textContent =
    `Unit Price: ${formatPrice(item.unitPrice)}`;


  const subtotal = document.createElement("p");

  subtotal.className = "order-item-subtotal";

  subtotal.textContent =
    `Subtotal: ${formatPrice(item.subtotal)}`;


  li.appendChild(name);
  li.appendChild(quantity);
  li.appendChild(unitPrice);
  li.appendChild(subtotal);


  const rating = createRatingSection(order, item);

  li.appendChild(rating);


  return li;
}


/* =========================================================
   RENDER ORDER
   ========================================================= */

function renderDetails(order) {
  detailsEl.innerHTML = "";


  /* Header */

  const header = document.createElement("div");

  header.className = "order-details-header";


  const title = document.createElement("h1");

  title.className = "order-details-title";

  title.textContent =
    `Order #${order.id}`;


  const status = document.createElement("span");

  status.className =
    `order-status status-${getStatusClass(order.status)}`;

  status.textContent =
    formatStatus(order.status);


  header.appendChild(title);
  header.appendChild(status);


  /* Meta */

  const meta = document.createElement("div");

  meta.className = "order-details-meta";


  const date = document.createElement("p");

  date.className = "order-date";

  date.innerHTML = `
    <i class="ri-calendar-line" aria-hidden="true"></i>
    Ordered ${escapeHtml(formatDate(order.createdAt))}
  `;


  const total = document.createElement("p");

  total.className = "order-total";

  total.textContent =
    `Total: ${formatPrice(order.totalAmount)}`;


  meta.appendChild(date);
  meta.appendChild(total);


  /* Shipping */

  const shippingSection =
    createShippingSection(order);

  if (shippingSection) {
    meta.appendChild(shippingSection);
  }


  /* Items */

  const itemsTitle =
    document.createElement("h2");

  itemsTitle.className =
    "order-items-title";

  itemsTitle.textContent =
    "Order Items";


  const itemsList =
    document.createElement("ul");

  itemsList.className =
    "order-items-list";


  const items =
    Array.isArray(order.items)
      ? order.items
      : [];


  if (items.length === 0) {
    const empty = document.createElement("li");

    empty.className = "order-item";

    empty.textContent =
      "No items were found for this order.";

    itemsList.appendChild(empty);
  } else {
    items.forEach((item) => {
      itemsList.appendChild(
        createOrderItem(order, item)
      );
    });
  }


  /* Continue */

  const actions =
    document.createElement("div");

  actions.className =
    "order-details-actions";


  const continueBtn =
    document.createElement("a");

  continueBtn.className =
    "btn btn-primary";

  continueBtn.href =
    "products.html";

  continueBtn.innerHTML = `
    Continue Shopping
    <i class="ri-arrow-right-line" aria-hidden="true"></i>
  `;


  actions.appendChild(continueBtn);


  detailsEl.appendChild(header);
  detailsEl.appendChild(meta);
  detailsEl.appendChild(itemsTitle);
  detailsEl.appendChild(itemsList);
  detailsEl.appendChild(actions);
}


/* =========================================================
   LOAD ORDER
   ========================================================= */

async function loadOrder() {
  const params =
    new URLSearchParams(window.location.search);

  const orderId =
    params.get("id");


  if (!orderId) {
    showInvalid();
    return;
  }


  const id =
    Number(orderId);


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    showInvalid();
    return;
  }


  showLoading();


  try {
    const result =
      await getOrderById(id);


    if (
      !result ||
      result.authenticated === false ||
      result.status === 401
    ) {
      showLoginRequired();
      return;
    }


    if (
      result.status === 404 ||
      !result.data?.order
    ) {
      showNotFound();
      return;
    }


    if (
      result.success === false &&
      result.status >= 400
    ) {
      showError(
        result.data?.message ||
        "Unable to load this order."
      );

      return;
    }


    showDetails(
      result.data.order
    );

  } catch (error) {
    console.error(
      "Failed to load order:",
      error
    );

    showError();
  }
}


document.addEventListener(
  "DOMContentLoaded",
  loadOrder
);