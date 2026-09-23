import { getOrderById, submitOrderItemRating } from "./api.js";
import { createStarSelector, createStarDisplay, setStarValue } from "./stars.js";

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

  const isCompleted = order.status === "completed";

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

    // Rating section for each item
    const ratingSection = document.createElement("div");
    ratingSection.className = "rating-section";

    const ratingLabel = document.createElement("p");
    ratingLabel.className = "rating-label";
    ratingLabel.textContent = "Your Rating";
    ratingSection.appendChild(ratingLabel);

    const hasRating = item.rating !== null && item.rating !== undefined;

    if (hasRating) {
      // Already rated — show read-only stars
      const stars = createStarDisplay(item.rating);
      stars.classList.add("rated-display");
      ratingSection.appendChild(stars);

      const ratedStatus = document.createElement("p");
      ratedStatus.className = "rating-status";
      ratedStatus.textContent = "Rated";
      ratingSection.appendChild(ratedStatus);
    } else if (isCompleted) {
      // Not rated yet and order is completed — show interactive stars
      const selector = createStarSelector(0);
      selector.id = `rating-selector-${item.id}`;
      ratingSection.appendChild(selector);

      let selectedRating = 0;

      selector.addEventListener("star-select", (e) => {
        selectedRating = e.detail.value;
      });

      const submitBtn = document.createElement("button");
      submitBtn.className = "btn btn-rating";
      submitBtn.textContent = "Submit Rating";
      submitBtn.disabled = true;
      submitBtn.addEventListener("click", async () => {
        if (selectedRating === 0) return;

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const messageEl = document.createElement("p");
        messageEl.className = "rating-message";
        ratingSection.appendChild(messageEl);

        try {
          const result = await submitOrderItemRating(order.id, item.id, selectedRating);

          if (result.status === 200 && result.data?.success) {
            messageEl.textContent = "Rating submitted successfully";
            messageEl.classList.remove("error");

            // Replace selector with read-only display
            ratingSection.innerHTML = "";
            ratingSection.appendChild(ratingLabel);

            const stars = createStarDisplay(result.data.data.rating);
            stars.classList.add("rated-display");
            ratingSection.appendChild(stars);

            const ratedStatus = document.createElement("p");
            ratedStatus.className = "rating-status";
            ratedStatus.textContent = "Rated";
            ratingSection.appendChild(ratedStatus);
          } else {
            messageEl.textContent = result.data?.message || "Failed to submit rating";
            messageEl.classList.add("error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Rating";
          }
        } catch (error) {
          console.error("Rating submission error:", error);
          messageEl.textContent = "An error occurred. Please try again.";
          messageEl.classList.add("error");
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Rating";
        }
      });

      // Enable submit button only when a rating is selected
      selector.addEventListener("star-select", (e) => {
        selectedRating = e.detail.value;
        submitBtn.disabled = selectedRating === 0;
      });

      ratingSection.appendChild(submitBtn);
    }

    li.appendChild(ratingSection);
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