// Cart utility module.
// The cart is stored ONLY in localStorage under the key "cart".
// Only product IDs and quantities are persisted — never prices.
// Product data always comes from the backend API.
//
// This module is intentionally side-effect free so it can be imported
// and tested in isolation.

const CART_KEY = "cart";

function safeParseCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn("Invalid cart data detected. Resetting cart.", error);
    try { localStorage.removeItem(CART_KEY); } catch (_) {}
    return [];
  }
}

function validateCart(cart) {
  if (!Array.isArray(cart)) return [];
  const seen = new Set();
  const cleaned = [];

  for (const item of cart) {
    if (!item || typeof item !== "object") continue;
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;

    if (seen.has(productId)) {
      // Merge duplicate entries for the same product.
      const existing = cleaned.find((c) => c.productId === productId);
      if (existing) {
        existing.quantity += quantity;
      }
      continue;
    }

    seen.add(productId);
    cleaned.push({ productId, quantity });
  }

  return cleaned;
}

function getCart() {
  return validateCart(safeParseCart());
}

function saveCart(cart) {
  const cleaned = validateCart(cart);
  localStorage.setItem(CART_KEY, JSON.stringify(cleaned));
  return cleaned;
}

function findItemIndex(cart, productId) {
  return cart.findIndex((item) => item.productId === Number(productId));
}

function addToCart(productId, quantity = 1) {
  const productIdNum = Number(productId);
  const quantityNum = Number(quantity);

  if (!Number.isInteger(productIdNum) || productIdNum <= 0) return null;
  if (!Number.isInteger(quantityNum) || quantityNum <= 0) return null;

  const cart = getCart();
  const index = findItemIndex(cart, productIdNum);

  if (index !== -1) {
    cart[index].quantity += quantityNum;
  } else {
    cart.push({ productId: productIdNum, quantity: quantityNum });
  }

  return saveCart(cart);
}

function updateCartItem(productId, quantity) {
  const productIdNum = Number(productId);
  const quantityNum = Number(quantity);

  if (!Number.isInteger(productIdNum) || productIdNum <= 0) return null;

  const cart = getCart();
  const index = findItemIndex(cart, productIdNum);

  if (index === -1) return null;

  if (!Number.isInteger(quantityNum) || quantityNum <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = quantityNum;
  }

  return saveCart(cart);
}

function increaseQuantity(productId, amount = 1) {
  const cart = getCart();
  const index = findItemIndex(cart, productId);
  if (index === -1) return null;
  cart[index].quantity += Number(amount) || 0;
  return saveCart(cart);
}

function decreaseQuantity(productId, amount = 1) {
  const cart = getCart();
  const index = findItemIndex(cart, productId);
  if (index === -1) return null;
  cart[index].quantity -= Number(amount) || 0;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  return saveCart(cart);
}

function removeFromCart(productId) {
  const cart = getCart().filter((item) => item.productId !== Number(productId));
  return saveCart(cart);
}

function clearCart() {
  localStorage.removeItem(CART_KEY);
  return [];
}

function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function isProductInCart(productId) {
  return getCart().some((item) => item.productId === Number(productId));
}

function getQuantity(productId) {
  const item = getCart().find((i) => i.productId === Number(productId));
  return item ? item.quantity : 0;
}

export {
  getCart,
  saveCart,
  addToCart,
  updateCartItem,
  increaseQuantity,
  decreaseQuantity,
  removeFromCart,
  clearCart,
  getCartItemCount,
  isProductInCart,
  getQuantity,
};