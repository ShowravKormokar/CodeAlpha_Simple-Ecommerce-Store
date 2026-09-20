import { registerUser } from "./api.js";

const form = document.getElementById("register-form");
const errorEl = document.getElementById("error-message");
const successEl = document.getElementById("success-message");
const registerBtn = document.getElementById("register-btn");

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = "block";
  successEl.style.display = "none";
}

function showSuccess(message) {
  successEl.textContent = message;
  successEl.style.display = "block";
  errorEl.style.display = "none";
}

function hideMessages() {
  errorEl.style.display = "none";
  successEl.style.display = "none";
}

function setLoading(isLoading) {
  if (isLoading) {
    registerBtn.disabled = true;
    registerBtn.textContent = "Creating account...";
  } else {
    registerBtn.disabled = false;
    registerBtn.textContent = "Register";
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessages();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!name) {
    showError("Name is required.");
    return;
  }

  if (!validateEmail(email)) {
    showError("A valid email is required.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters long.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Password confirmation does not match.");
    return;
  }

  setLoading(true);

  try {
    const result = await registerUser(name, email, password, confirmPassword);

    if (result.status === 201 && result.data.success) {
      showSuccess("Registration successful! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else if (result.status === 409) {
      showError(result.data.message || "An account with this email already exists");
    } else if (result.status === 400) {
      showError(result.data.message || "Invalid input");
    } else {
      showError("Unable to register. Please try again.");
    }
  } catch (error) {
    console.error("Register error:", error);
    showError("Unable to register. Please try again.");
  } finally {
    setLoading(false);
  }
});