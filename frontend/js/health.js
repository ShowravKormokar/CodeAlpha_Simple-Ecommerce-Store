import API_BASE_URL from "./api.js";

const backendStatusEl = document.getElementById("backend-status");
const databaseStatusEl = document.getElementById("database-status");

export function updateStatus(data) {
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
}

export function setErrorStatus() {
  backendStatusEl.textContent = "API: unreachable";
  backendStatusEl.className = "error";
  databaseStatusEl.textContent = "Database: unknown";
  databaseStatusEl.className = "error";
}

export async function fetchHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return await response.json();
}