const API_BASE_URL = "http://localhost:5000/api";

export default API_BASE_URL;

export async function getProducts() {
  const response = await fetch(`${API_BASE_URL}/products`);

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return await response.json();
}

export async function getProductById(id) {
  const response = await fetch(`${API_BASE_URL}/products/${id}`);

  if (response.status === 404) {
    return { success: false, message: "Product not found" };
  }

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return await response.json();
}