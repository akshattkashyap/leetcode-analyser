// popup.js — Settings page logic

const apiKeyInput = document.getElementById("api-key");
const toggleBtn = document.getElementById("toggle-visibility");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");

// Load existing key on open
chrome.storage.local.get("groq_api_key", ({ groq_api_key }) => {
  if (groq_api_key) {
    apiKeyInput.value = groq_api_key;
  }
});

// Show / Hide toggle
toggleBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleBtn.textContent = isPassword ? "🙈" : "👁";
});

// Save key
saveBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();

  if (!key) {
    showStatus("Please enter an API key.", "error");
    return;
  }

  chrome.storage.local.set({ groq_api_key: key }, () => {
    showStatus("✓ API key saved successfully!", "success");
  });
});

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;

  setTimeout(() => {
    statusEl.textContent = "";
    statusEl.className = "status";
  }, 3000);
}
