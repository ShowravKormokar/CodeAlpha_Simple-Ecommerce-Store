import * as cart from "./cart.js";
import { getProducts } from "./api.js";


const loadingEl = document.getElementById("loading");
const emptyEl = document.getElementById("empty-state");
const errorEl = document.getElementById("error-state");

const itemsContainer =
  document.getElementById("cart-items-container");

const summaryEl =
  document.getElementById("cart-summary");

const retryBtn =
  document.getElementById("retry-cart");

const clearCartBtn =
  document.getElementById("clear-cart-btn");

const checkoutBtn =
  document.getElementById("checkout-btn");


function formatPrice(value) {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}


function showLoading() {
  loadingEl.style.display = "block";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}


function showEmpty() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "block";
  errorEl.style.display = "none";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}


function showError() {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "block";
  itemsContainer.style.display = "none";
  summaryEl.style.display = "none";
}


function showCart(items, productsById) {
  loadingEl.style.display = "none";
  emptyEl.style.display = "none";
  errorEl.style.display = "none";

  itemsContainer.style.display = "block";
  summaryEl.style.display = "block";

  renderItems(items, productsById);
  renderSummary(items, productsById);
}


function renderItems(items, productsById) {
  itemsContainer.innerHTML = "";


  items.forEach((item) => {
    const product =
      productsById.get(Number(item.productId));


    /* Product unavailable */

    if (!product) {
      const row =
        document.createElement("article");

      row.className = "cart-item";


      const info =
        document.createElement("div");

      info.className =
        "cart-item-info";


      const message =
        document.createElement("p");

      message.className =
        "muted";

      message.textContent =
        `Product #${item.productId} is no longer available.`;


      const remove =
        document.createElement("button");

      remove.className =
        "btn btn-secondary remove-btn";

      remove.type = "button";

      remove.textContent =
        "Remove";

      remove.addEventListener(
        "click",
        () => handleRemove(item.productId)
      );


      info.appendChild(message);

      row.appendChild(info);
      row.appendChild(remove);

      itemsContainer.appendChild(row);

      return;
    }


    const stock =
      Number(product.stock_quantity);


    const row =
      document.createElement("article");

    row.className =
      "cart-item";


    /* Image */

    const img =
      document.createElement("img");

    img.src =
      product.image_url ||
      createPlaceholderImage();

    img.alt =
      product.name;

    img.loading =
      "lazy";

    img.onerror = () => {
      img.src =
        createPlaceholderImage();
    };


    /* Product info */

    const info =
      document.createElement("div");

    info.className =
      "cart-item-info";


    const name =
      document.createElement("h3");

    name.className =
      "cart-item-name";

    name.textContent =
      product.name;


    const isSale =
      Boolean(product.offer_sale) &&
      product.offer_price != null;

    const hasDiscount =
      isSale &&
      product.regular_price != null &&
      Number(product.regular_price) > 0 &&
      Number(product.regular_price) >
        Number(product.price);

    const price =
      document.createElement("p");

    price.className =
      "cart-item-price";

    if (hasDiscount) {
      const priceWrapper =
        document.createElement("span");

      priceWrapper.className =
        "cart-item-price-wrapper";

      const currentPrice =
        document.createElement("span");

      currentPrice.className =
        "cart-item-current-price";

      currentPrice.textContent =
        formatPrice(product.price);

      const regularPrice =
        document.createElement("span");

      regularPrice.className =
        "cart-item-regular-price";

      regularPrice.textContent =
        formatPrice(product.regular_price);

      priceWrapper.appendChild(
        currentPrice
      );

      priceWrapper.appendChild(
        regularPrice
      );

      price.appendChild(
        priceWrapper
      );
    } else {
      price.textContent =
        formatPrice(product.price);
    }


    const stockEl =
      document.createElement("p");

    stockEl.className =
      "cart-item-stock";


    if (stock <= 0) {
      stockEl.textContent =
        "Out of stock";

      stockEl.classList.add(
        "out-of-stock"
      );

    } else if (stock < 5) {
      stockEl.textContent =
        `Only ${stock} left`;

      stockEl.classList.add(
        "low-stock"
      );

    } else {
      stockEl.textContent =
        `${stock} available`;

      stockEl.classList.add(
        "in-stock"
      );
    }


    info.appendChild(name);
    info.appendChild(price);
    info.appendChild(stockEl);


    /* Quantity */

    const controls =
      document.createElement("div");

    controls.className =
      "cart-item-controls";


    const dec =
      document.createElement("button");

    dec.className =
      "qty-btn";

    dec.type =
      "button";

    dec.textContent =
      "−";

    dec.setAttribute(
      "aria-label",
      `Decrease quantity of ${product.name}`
    );

    dec.disabled =
      item.quantity <= 1;

    dec.addEventListener(
      "click",
      () => handleDecrease(item.productId)
    );


    const qty =
      document.createElement("span");

    qty.className =
      "qty-value";

    qty.textContent =
      item.quantity;


    const inc =
      document.createElement("button");

    inc.className =
      "qty-btn";

    inc.type =
      "button";

    inc.textContent =
      "+";

    inc.setAttribute(
      "aria-label",
      `Increase quantity of ${product.name}`
    );

    inc.disabled =
      stock <= 0 ||
      item.quantity >= stock;

    inc.addEventListener(
      "click",
      () =>
        handleIncrease(
          item.productId,
          stock
        )
    );


    controls.appendChild(dec);
    controls.appendChild(qty);
    controls.appendChild(inc);


    /* Subtotal */

    const subtotal =
      document.createElement("div");

    subtotal.className =
      "cart-item-subtotal";

    subtotal.textContent =
      formatPrice(
        Number(product.price) *
        item.quantity
      );


    /* Remove */

    const remove =
      document.createElement("button");

    remove.className =
      "btn btn-secondary remove-btn";

    remove.type =
      "button";

    remove.textContent =
      "Remove";

    remove.setAttribute(
      "aria-label",
      `Remove ${product.name} from cart`
    );

    remove.addEventListener(
      "click",
      () => handleRemove(item.productId)
    );


    row.appendChild(img);
    row.appendChild(info);
    row.appendChild(controls);
    row.appendChild(subtotal);
    row.appendChild(remove);

    itemsContainer.appendChild(row);
  });
}


function renderSummary(items, productsById) {
  let subtotal = 0;


  items.forEach((item) => {
    const product =
      productsById.get(Number(item.productId));

    if (!product) {
      return;
    }

    subtotal +=
      Number(product.price) *
      item.quantity;
  });


  document.getElementById(
    "cart-subtotal"
  ).textContent =
    formatPrice(subtotal);


  document.getElementById(
    "cart-total"
  ).textContent =
    formatPrice(subtotal);
}


function handleIncrease(productId, stockLimit) {
  const currentQuantity =
    cart.getQuantity(productId);


  if (
    stockLimit <= 0 ||
    currentQuantity >= stockLimit
  ) {
    return;
  }


  cart.updateCartItem(
    productId,
    currentQuantity + 1
  );

  loadCart();
}


function handleDecrease(productId) {
  cart.decreaseQuantity(productId);

  loadCart();
}


function handleRemove(productId) {
  cart.removeFromCart(productId);

  loadCart();
}


function createPlaceholderImage() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23f1f5f9'/%3E%3C/svg%3E";
}


async function loadCart() {
  const cartItems =
    cart.getCart();


  if (cartItems.length === 0) {
    showEmpty();
    return;
  }


  showLoading();


  try {
    const result =
      await getProducts();


    if (
      !result ||
      !result.success
    ) {
      showError();
      return;
    }


    const productsById =
      new Map(
        (result.data || []).map(
          (product) => [
            Number(product.id),
            product,
          ]
        )
      );


    /*
     * Remove invalid cart quantities if
     * current stock is lower than cart quantity.
     */

    let cartChanged = false;


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


      if (
        stock > 0 &&
        item.quantity > stock
      ) {
        cart.updateCartItem(
          item.productId,
          stock
        );

        cartChanged = true;
      }

      if (stock <= 0) {
        cart.removeFromCart(
          item.productId
        );

        cartChanged = true;
      }
    });


    if (cartChanged) {
      const refreshedCart =
        cart.getCart();

      if (refreshedCart.length === 0) {
        showEmpty();
        return;
      }

      showCart(
        refreshedCart,
        productsById
      );

      return;
    }


    showCart(
      cartItems,
      productsById
    );

  } catch (error) {
    console.error(
      "Failed to load cart products:",
      error
    );

    showError();
  }
}


/* Clear */

clearCartBtn?.addEventListener(
  "click",
  () => {
    if (!cart.getCart().length) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove all items from your cart?"
      );

    if (!confirmed) {
      return;
    }

    cart.clearCart();

    loadCart();
  }
);


/* Checkout */

checkoutBtn?.addEventListener(
  "click",
  () => {
    if (!cart.getCart().length) {
      return;
    }

    window.location.href =
      "checkout.html";
  }
);


/* Retry */

retryBtn?.addEventListener(
  "click",
  loadCart
);


document.addEventListener(
  "DOMContentLoaded",
  loadCart
);