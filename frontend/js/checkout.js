import * as cart from "./cart.js";

import {
  getProducts,
  getCurrentUser,
  createOrder,
} from "./api.js";


const loadingEl =
  document.getElementById("loading");

const errorEl =
  document.getElementById("error-state");

const errorMessageEl =
  document.getElementById("error-message");

const emptyEl =
  document.getElementById("empty-state");

const contentEl =
  document.getElementById("checkout-content");

const form =
  document.getElementById("checkout-form");

const placeOrderBtn =
  document.getElementById("place-order-btn");

const btnText =
  placeOrderBtn.querySelector(".btn-text");

const btnLoading =
  placeOrderBtn.querySelector(".btn-loading");

const summaryItemsEl =
  document.getElementById("order-summary-items");

const summarySubtotalEl =
  document.getElementById("summary-subtotal");

const summaryShippingEl =
  document.getElementById("summary-shipping");

const summaryTaxEl =
  document.getElementById("summary-tax");

const summaryTotalEl =
  document.getElementById("summary-total");


let productsById = new Map();
let cartItems = [];


/* =========================================================
   FORMAT
   ========================================================= */

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


/* =========================================================
   STATES
   ========================================================= */

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

  if (message) {
    errorMessageEl.textContent =
      message;
  }
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

    <p>
      You need to be logged in to place an order.
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
  contentEl.style.display = "none";
}


function showContent() {
  loadingEl.style.display = "none";
  errorEl.style.display = "none";
  emptyEl.style.display = "none";
  contentEl.style.display = "block";
}


/* =========================================================
   SUBMIT STATE
   ========================================================= */

function setSubmitting(isSubmitting) {
  placeOrderBtn.disabled =
    isSubmitting;

  btnText.style.display =
    isSubmitting
      ? "none"
      : "inline-flex";

  btnLoading.style.display =
    isSubmitting
      ? "inline-flex"
      : "none";
}


/* =========================================================
   VALIDATION
   ========================================================= */

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


function getErrorElement(fieldName) {
  return document.getElementById(
    `error-${fieldName
      .replace(/[A-Z]/g, (char) => char.toLowerCase())}`
  );
}


function validateForm() {
  let isValid = true;


  requiredFields.forEach(
    (fieldName) => {
      const input =
        form.elements.namedItem(
          fieldName
        );

      const errorElement =
        getErrorElement(fieldName);


      if (
        !input ||
        !input.value.trim()
      ) {
        input?.classList.add(
          "invalid"
        );

        if (errorElement) {
          errorElement.textContent =
            "This field is required.";
        }

        isValid = false;

      } else {
        input.classList.remove(
          "invalid"
        );

        if (errorElement) {
          errorElement.textContent =
            "";
        }
      }
    }
  );


  /* Email */

  const emailInput =
    form.elements.namedItem(
      "shippingEmail"
    );

  const email =
    emailInput.value.trim();


  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    emailInput.classList.add(
      "invalid"
    );

    const errorElement =
      getErrorElement(
        "shippingEmail"
      );

    if (errorElement) {
      errorElement.textContent =
        "Please enter a valid email address.";
    }

    isValid = false;
  }


  return isValid;
}


function clearFieldError(fieldName) {
  const input =
    form.elements.namedItem(
      fieldName
    );

  const errorElement =
    getErrorElement(fieldName);


  if (!input) {
    return;
  }


  input.classList.remove(
    "invalid"
  );


  if (errorElement) {
    errorElement.textContent =
      "";
  }
}


/* =========================================================
   SUMMARY
   ========================================================= */

function createPlaceholderImage() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect width='60' height='60' fill='%23f1f5f9'/%3E%3C/svg%3E";
}


function renderOrderSummary(items) {
  summaryItemsEl.innerHTML = "";

  let subtotal = 0;


  items.forEach((item) => {
    const product =
      productsById.get(
        Number(item.productId)
      );


    if (!product) {
      return;
    }


    const price =
      Number(product.price);

    const quantity =
      Number(item.quantity);


    subtotal +=
      price * quantity;


    const itemEl =
      document.createElement("div");

    itemEl.className =
      "summary-item";


    const info =
      document.createElement("div");

    info.className =
      "summary-item-info";


    const image =
      document.createElement("img");

    image.src =
      product.image_url ||
      createPlaceholderImage();

    image.alt =
      product.name;

    image.width = 60;
    image.height = 60;


    const infoText =
      document.createElement("div");


    const name =
      document.createElement("strong");

    name.textContent =
      product.name;


    const quantityEl =
      document.createElement("span");

    quantityEl.className =
      "muted";

    quantityEl.textContent =
      `Qty: ${quantity}`;


    infoText.appendChild(name);
    infoText.appendChild(quantityEl);


    info.appendChild(image);
    info.appendChild(infoText);


    const itemPrice =
      document.createElement("span");

    itemPrice.className =
      "summary-item-price";

    itemPrice.textContent =
      formatPrice(
        price * quantity
      );


    itemEl.appendChild(info);
    itemEl.appendChild(itemPrice);

    summaryItemsEl.appendChild(
      itemEl
    );
  });


  const shipping = 0;

  /*
   * Keep this aligned with the current
   * assignment behavior.
   */
  const tax =
    Math.round(
      subtotal * 0.08 * 100
    ) / 100;

  const total =
    subtotal +
    shipping +
    tax;


  summarySubtotalEl.textContent =
    formatPrice(subtotal);

  summaryShippingEl.textContent =
    formatPrice(shipping);

  summaryTaxEl.textContent =
    formatPrice(tax);

  summaryTotalEl.textContent =
    formatPrice(total);
}


/* =========================================================
   LOAD CHECKOUT
   ========================================================= */

async function loadCheckout() {
  showLoading();


  cartItems =
    cart.getCart();


  if (!cartItems.length) {
    showEmpty();
    return;
  }


  try {
    const auth =
      await getCurrentUser();


    if (
      !auth ||
      auth.authenticated === false
    ) {
      showLoginRequired();
      return;
    }


    const result =
      await getProducts();


    if (
      !result ||
      !result.success
    ) {
      showError(
        "Unable to load product information."
      );

      return;
    }


    productsById =
      new Map(
        (result.data || []).map(
          (product) => [
            Number(product.id),
            product,
          ]
        )
      );


    /*
     * Remove products that no longer
     * exist and clamp quantities to stock.
     */

    const validCartItems = [];


    cartItems.forEach((item) => {
      const product =
        productsById.get(
          Number(item.productId)
        );


      if (!product) {
        return;
      }


      const stock =
        Number(product.stock_quantity);


      if (stock <= 0) {
        return;
      }


      const quantity =
        Math.min(
          Number(item.quantity),
          stock
        );


      if (quantity > 0) {
        validCartItems.push({
          productId:
            Number(item.productId),

          quantity,
        });
      }
    });


    if (!validCartItems.length) {
      cart.clearCart();
      showEmpty();
      return;
    }


    cartItems =
      validCartItems;


    cart.saveCart(
      cartItems
    );


    renderOrderSummary(
      cartItems
    );


    showContent();

  } catch (error) {
    console.error(
      "Failed to load checkout:",
      error
    );

    showError(
      "Unable to load checkout. Please try again."
    );
  }
}


/* =========================================================
   SHIPPING
   ========================================================= */

function collectShippingInfo() {
  return {
    name:
      form.elements
        .namedItem("shippingName")
        .value
        .trim(),

    email:
      form.elements
        .namedItem("shippingEmail")
        .value
        .trim(),

    phone:
      form.elements
        .namedItem("shippingPhone")
        .value
        .trim(),

    addressLine1:
      form.elements
        .namedItem("shippingAddressLine1")
        .value
        .trim(),

    addressLine2:
      form.elements
        .namedItem("shippingAddressLine2")
        .value
        .trim(),

    city:
      form.elements
        .namedItem("shippingCity")
        .value
        .trim(),

    state:
      form.elements
        .namedItem("shippingState")
        .value
        .trim(),

    postalCode:
      form.elements
        .namedItem("shippingPostalCode")
        .value
        .trim(),

    country:
      form.elements
        .namedItem("shippingCountry")
        .value
        .trim(),
  };
}


/* =========================================================
   SUBMIT
   ========================================================= */

async function handleSubmit(event) {
  event.preventDefault();


  if (!validateForm()) {
    return;
  }


  const latestCart =
    cart.getCart();


  if (!latestCart.length) {
    showEmpty();
    return;
  }


  setSubmitting(true);


  try {
    const shippingInfo =
      collectShippingInfo();


    const result =
      await createOrder(
        latestCart,
        shippingInfo
      );


    if (
      result?.status === 201 &&
      result?.data?.success
    ) {
      const order =
        result.data.data?.order;


      if (!order?.id) {
        throw new Error(
          "Order was created but no order ID was returned."
        );
      }


      cart.clearCart();


      window.location.href =
        `order-details.html?id=${encodeURIComponent(
          order.id
        )}`;

      return;
    }


    if (result?.status === 401) {
      showLoginRequired();
      return;
    }


    if (result?.status === 404) {
      alert(
        result.data?.message ||
        "A product in your cart was not found."
      );

      return;
    }


    if (result?.status === 409) {
      alert(
        result.data?.message ||
        "Insufficient stock for an item in your cart."
      );

      await loadCheckout();
      return;
    }


    if (result?.status === 400) {
      alert(
        result.data?.message ||
        "Invalid order request."
      );

      return;
    }


    alert(
      "Unable to place your order. Please try again."
    );

  } catch (error) {
    console.error(
      "Checkout error:",
      error
    );

    alert(
      "Unable to place your order. Please try again."
    );

  } finally {
    setSubmitting(false);
  }
}


/* =========================================================
   REAL-TIME VALIDATION
   ========================================================= */

requiredFields.forEach(
  (fieldName) => {
    const input =
      form.elements.namedItem(
        fieldName
      );


    if (!input) {
      return;
    }


    input.addEventListener(
      "input",
      () => clearFieldError(fieldName)
    );


    input.addEventListener(
      "blur",
      () => {
        if (input.value.trim()) {
          clearFieldError(fieldName);
        }
      }
    );
  }
);


form.addEventListener(
  "submit",
  handleSubmit
);


document.addEventListener(
  "DOMContentLoaded",
  loadCheckout
);