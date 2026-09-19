const API_BASE_URL = "http://localhost:5000/api";

const backendStatusEl = document.getElementById("backend-status");
const databaseStatusEl = document.getElementById("database-status");

async function checkStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();

    if (data.success) {
      backendStatusEl.textContent = "API: healthy";
      backendStatusEl.className = "success";

      if (data.database === "connected") {
        databaseStatusEl.textContent = "Database: connected";
        databaseStatusEl.className = "success";
      } else {
        databaseStatusEl.textContent = "Database: disconnected";
        databaseStatusEl.className = "error";
      }
    } else {
      backendStatusEl.textContent = "API: unhealthy";
      backendStatusEl.className = "error";
      databaseStatusEl.textContent = "Database: unknown";
      databaseStatusEl.className = "error";
    }
  } catch (error) {
    backendStatusEl.textContent = "API: unreachable";
    backendStatusEl.className = "error";
    databaseStatusEl.textContent = "Database: unknown";
    databaseStatusEl.className = "error";
    console.error("Failed to fetch health status:", error);
  }
}

document.addEventListener("DOMContentLoaded", checkStatus);