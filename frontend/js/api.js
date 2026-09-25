// Backend port is configured in backend/.env (PORT).
// The API base URL is derived from the frontend's own origin so the
// app works whether the frontend is served from localhost or 127.0.0.1.
const BACKEND_PORT = 5000;

function buildApiBaseUrl() {
  if (typeof window !== "undefined" && window.location) {
    const { hostname } = window.location;
    return `http://${hostname}:${BACKEND_PORT}/api`;
  }
  return `http://localhost:${BACKEND_PORT}/api`;
}

const API_BASE_URL = buildApiBaseUrl();

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

export async function getProducts(params = {}, options = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });

  const queryString = query.toString();
  const path = queryString ? `/products?${queryString}` : "/products";
  const { response, data } = await request(path, options);

  if (!response.ok) {
    const error = new Error(
      data?.message || `Unable to load products (${response.status})`
    );
    error.status = response.status;
    error.responseData = data;
    throw error;
  }

  return data;
}

export async function getFeaturedProducts() {
  return getProducts({ featured: "true" });
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

  return { authenticated: true, data: data.data };
}

export async function createOrder(items, shipping = {}, payment = {}) {
  const { response, data } = await request("/orders", {
    method: "POST",
    body: JSON.stringify({ items, shipping, payment }),
  });

  return { status: response.status, data };
}

export async function getOrders() {
  const { response, data } = await request("/orders");

  if (response.status === 401) {
    return { authenticated: false, data };
  }

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return { authenticated: true, data: data.data };
}

export async function getOrderById(orderId) {
  const { response, data } = await request(`/orders/${orderId}`);

  if (response.status === 401) {
    return { authenticated: false, data };
  }

  if (response.status === 404) {
    return { authenticated: true, data: null };
  }

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return { authenticated: true, data: data.data };
}

// POST /api/orders/:orderId/items/:orderItemId/rating
export async function submitOrderItemRating(orderId, orderItemId, rating) {
  const { response, data } = await request(
    `/orders/${orderId}/items/${orderItemId}/rating`,
    {
      method: "POST",
      body: JSON.stringify({ rating }),
    }
  );

  return { status: response.status, data };
}