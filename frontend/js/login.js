import { loginUser, getCurrentUser } from "./api.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("error-message");
const loginBtn = document.getElementById("login-btn");

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
}

function hideError() {
  errorEl.style.display = "none";
}

function setLoading(isLoading) {
  if (isLoading) {
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";
  } else {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
}

async function checkAuth() {
  try {
    const result = await getCurrentUser();
    if (result.authenticated) {
      window.location.href = "index.html";
    }
  } catch (error) {
    // Not authenticated — stay on login page.
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showError("Email and password are required.");
    return;
  }

  setLoading(true);

  try {
    const result = await loginUser(email, password);

    if (result.status === 200 && result.data.success) {
      window.location.href = "index.html";
    } else if (result.status === 401) {
      showError(result.data.message || "Invalid email or password");
    } else if (result.status === 400) {
      showError(result.data.message || "Invalid input");
    } else {
      showError("Unable to login. Please try again.");
    }
  } catch (error) {
    console.error("Login error:", error);
    showError("Unable to login. Please try again.");
  } finally {
    setLoading(false);
  }
});

document.addEventListener("DOMContentLoaded", checkAuth);