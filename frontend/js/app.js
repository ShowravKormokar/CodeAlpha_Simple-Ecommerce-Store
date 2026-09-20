import { getCurrentUser, logoutUser } from "./api.js";
import * as cart from "./cart.js";

async function updateNavigation() {
  const navLinks = document.getElementById("nav-links");
  if (!navLinks) return;

  const cartCount = cart.getCartItemCount();
  const cartLink = `<li><a href="cart.html">Cart (${cartCount})</a></li>`;

  try {
    const result = await getCurrentUser();

    if (result.authenticated && result.data && result.data.user) {
      const user = result.data.user;
      navLinks.innerHTML = `
        <li><a href="index.html" class="active">Home</a></li>
        <li><a href="products.html">Products</a></li>
        ${cartLink}
        <li><a href="#" id="logout-link">Welcome, ${escapeHtml(user.name)}</a></li>
      `;
      const logoutLink = document.getElementById("logout-link");
      if (logoutLink) {
        logoutLink.addEventListener("click", handleLogout);
      }
    } else {
      navLinks.innerHTML = `
        <li><a href="index.html" class="active">Home</a></li>
        <li><a href="products.html">Products</a></li>
        ${cartLink}
        <li><a href="login.html">Login</a></li>
        <li><a href="register.html">Register</a></li>
      `;
    }
  } catch (error) {
    console.error("Failed to update navigation:", error);
    // Fallback: still show cart link with count
    navLinks.innerHTML = `
      <li><a href="index.html" class="active">Home</a></li>
      <li><a href="products.html">Products</a></li>
      ${cartLink}
      <li><a href="login.html">Login</a></li>
      <li><a href="register.html">Register</a></li>
    `;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function handleLogout(event) {
  event.preventDefault();
  try {
    await logoutUser();
    window.location.href = "index.html";
  } catch (error) {
    console.error("Logout error:", error);
  }
}

document.addEventListener("DOMContentLoaded", updateNavigation);