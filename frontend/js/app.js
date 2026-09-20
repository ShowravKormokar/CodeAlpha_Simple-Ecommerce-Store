import { getCurrentUser, logoutUser } from "./api.js";

async function updateNavigation() {
  const navLinks = document.getElementById("nav-links");
  if (!navLinks) return;

  try {
    const result = await getCurrentUser();

    if (result.authenticated && result.data && result.data.user) {
      const user = result.data.user;
      navLinks.innerHTML = `
        <li><a href="index.html" class="active">Home</a></li>
        <li><a href="products.html">Products</a></li>
        <li><a href="#" class="disabled">Cart</a></li>
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
        <li><a href="login.html">Login</a></li>
        <li><a href="register.html">Register</a></li>
        <li><a href="#" class="disabled">Cart</a></li>
      `;
    }
  } catch (error) {
    console.error("Failed to update navigation:", error);
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