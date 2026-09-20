const API_BASE_URL = "http://localhost:5000/api";

export default API_BASE_URL;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  return { response, data };
}

export async function getProducts() {
  const { response, data } = await request("/products");

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return data;
}

export async function getProductById(id) {
  const { response, data } = await request(`/products/${id}`);

  if (response.status === 404) {
    return { success: false, message: "Product not found" };
  }

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return data;
}

export async function registerUser(name, email, password, confirmPassword) {
  const { response, data } = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, confirmPassword }),
  });

  return { status: response.status, data };
}

export async function loginUser(email, password) {
  const { response, data } = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  return { status: response.status, data };
}

export async function logoutUser() {
  const { response, data } = await request("/auth/logout", {
    method: "POST",
  });

  return { status: response.status, data };
}

export async function getCurrentUser() {
  const { response, data } = await request("/auth/me");

  if (response.status === 401) {
    return { authenticated: false, data };
  }

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return { authenticated: true, data };
}