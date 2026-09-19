import API_BASE_URL from "./api.js";
import { fetchHealth, updateStatus, setErrorStatus } from "./health.js";

async function checkStatus() {
  try {
    const data = await fetchHealth();
    updateStatus(data);
  } catch (error) {
    setErrorStatus();
    console.error("Failed to fetch health status:", error);
  }
}

document.addEventListener("DOMContentLoaded", checkStatus);