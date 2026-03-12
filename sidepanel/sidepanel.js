document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const toggleVisibilityBtn = document.getElementById("toggle-visibility");
  const settingsStatus = document.getElementById("settings-status");
  
  const analyzeSection = document.getElementById("analyze-section");
  const analyzeStatus = document.getElementById("analyze-status");
  const retryBtn = document.getElementById("retry-btn");
  const resultsContainer = document.getElementById("results-container");

  const settingsSection = document.getElementById("settings-section");
  const settingsToggle = document.getElementById("settings-toggle");
  
  settingsToggle.addEventListener("click", () => {
    // Only do something if settings are currently hidden
    if (settingsSection.style.display === "none") {
      settingsSection.style.display = "block";
      settingsToggle.style.display = "none";
      
      // Hide results while configuring API key
      resultsContainer.style.display = "none";
      resultsContainer.innerHTML = "";
      analyzeSection.style.display = "none";
    }
  });

  // Load API Key
  const { groq_api_key } = await chrome.storage.local.get("groq_api_key");
  if (groq_api_key) {
    apiKeyInput.value = groq_api_key;
    settingsSection.style.display = "none";
    settingsToggle.style.display = "block";
    analyzeSection.style.display = "block";
  }

  // Toggle Visibility
  toggleVisibilityBtn.addEventListener("click", () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleVisibilityBtn.textContent = "🙈";
    } else {
      apiKeyInput.type = "password";
      toggleVisibilityBtn.textContent = "👁";
    }
  });

  // Save Key
  saveKeyBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus(settingsStatus, "Please enter an API key", "error");
      return;
    }

    try {
      await chrome.storage.local.set({ groq_api_key: key });
      showStatus(settingsStatus, "API key saved!", "success");
      
      settingsSection.style.display = "none";
      settingsToggle.style.display = "block";
      analyzeSection.style.display = "block";
      performAnalysis(); // Auto-analyze after saving new key
    } catch (err) {
      showStatus(settingsStatus, "Failed to save key", "error");
    }
  });

  // Analysis Logic
  retryBtn.addEventListener("click", performAnalysis);

  async function performAnalysis() {
    retryBtn.style.display = "none";
    
    // Query ALL tabs that match the LeetCode URL pattern, ignoring "active" state
    // because clicking the side panel strips "active" state from the main window's tab
    const tabs = await chrome.tabs.query({ url: "*://*.leetcode.com/problems/*" });
    
    // Pick the first matching tab
    const tab = tabs[0];
    
    if (!tab) {
      showStatus(analyzeStatus, "Please open a LeetCode problem page", "error");
      retryBtn.style.display = "block";
      return;
    }

    resultsContainer.style.display = "none";
    resultsContainer.innerHTML = "";
    analyzeStatus.style.display = "block";
    showStatus(analyzeStatus, "Extracting code via content script...", "loading");

    try {
      // 1. Ask content script to extract question and code
      const extractedData = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: "extractData" }, (response) => {
          if (chrome.runtime.lastError) {
             reject(new Error("Content script not responding. Refresh the LeetCode tab."));
          } else if (response && response.error) {
             reject(new Error(response.error));
          } else {
             resolve(response);
          }
        });
      });

      if (!extractedData || !extractedData.code || !extractedData.question) {
        throw new Error("Failed to extract code or question.");
      }

      showStatus(analyzeStatus, "AI is analyzing your code...", "loading");

      // 2. Send to background.js for Groq API call
      const aiResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "analyzeCode",
            data: {
              problemTitle: extractedData.questionTitle,
              questionDescription: extractedData.question,
              language: extractedData.language || "Unknown",
              code: extractedData.code
            }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error("Error communicating with background script."));
            } else if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.result);
            }
          }
        );
      });

      // 3. Render results
      showStatus(analyzeStatus, "", "");
      renderResults(aiResponse);

    } catch (err) {
      analyzeStatus.style.display = "block";
      showStatus(analyzeStatus, err.message, "error");
      retryBtn.style.display = "block";
    }
  }

  // Auto-run on load if API key exists
  if (groq_api_key) {
    performAnalysis();
  }

  function showStatus(element, text, type) {
    if (!text) {
      element.style.display = "none";
      return;
    }
    element.textContent = text;
    element.className = `status ${type}`;
    if (type === "success") {
      setTimeout(() => { if(element.textContent === text) element.style.display = "none"; }, 4000);
    }
  }

  function renderResults(data) {
    resultsContainer.innerHTML = "";
    
    const wrapper = document.createElement("div");
    
    // Badge row
    const badgeRow = document.createElement("div");
    badgeRow.className = "lc-badges";
    ["✓ Approach", "✓ Efficiency", "✓ Code Style"].forEach(label => {
      const b = document.createElement("span");
      b.className = "lc-badge";
      b.textContent = label;
      badgeRow.appendChild(b);
    });
    wrapper.appendChild(badgeRow);

    const congrats = document.createElement("div");
    congrats.className = "lc-congrats";
    congrats.textContent = data.congratulations || "";
    wrapper.appendChild(congrats);

    const divider = document.createElement("hr");
    divider.className = "lc-divider";
    wrapper.appendChild(divider);

    // Approach
    const approachSection = createSection("Approach", () => {
      const obj = data.approach;
      return `
        <div class="lc-row">
          <span class="lc-row-label">Current:</span>
          <span class="lc-row-value">${formatTags(obj.current_tags)}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Suggested:</span>
          <span class="lc-row-value">${formatTags(obj.suggested_tags)}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Key Idea:</span>
          <span class="lc-row-value">${obj.key_idea}</span>
        </div>
      `;
    });

    // Efficiency
    const efficiencySection = createSection("Efficiency", () => {
      const obj = data.efficiency;
      return `
        <div class="lc-row">
          <span class="lc-row-label">Current complexity:</span>
          <span class="lc-complexity lc-complexity-current">${obj.current_complexity}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Suggested complexity:</span>
          <span class="lc-complexity lc-complexity-suggested">${obj.suggested_complexity}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Suggestions:</span>
          <span class="lc-row-value">${obj.suggestion}</span>
        </div>
      `;
    });

    // Style
    const styleSection = createSection("Code Style", () => {
      const obj = data.code_style;
      return `
        <div class="lc-row">
          <span class="lc-row-label">Readability:</span>
          <span class="lc-stars">${generateStars(obj.readability)}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Structure:</span>
          <span class="lc-stars">${generateStars(obj.structure)}</span>
        </div>
        <div class="lc-row">
          <span class="lc-row-label">Suggestions:</span>
          <span class="lc-row-value">${obj.suggestion}</span>
        </div>
      `;
    });

    wrapper.appendChild(approachSection);
    wrapper.appendChild(efficiencySection);
    wrapper.appendChild(styleSection);

    resultsContainer.appendChild(wrapper);
    resultsContainer.style.display = "block";
  }

  function createSection(title, contentFn) {
    const section = document.createElement("div");
    section.className = "lc-section-wrap";
    
    const h = document.createElement("h2");
    h.className = "lc-section-heading";
    h.textContent = title;
    section.appendChild(h);

    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = contentFn();
    section.appendChild(contentDiv);

    return section;
  }

  function formatTags(tagsArray) {
    if (!tagsArray || tagsArray.length === 0) return "None";
    return tagsArray.map(t => `<span class="lc-tag">${t.replace(/\b\w/g, c => c.toUpperCase())}</span>`).join('<span class="lc-tag-separator">/</span>');
  }

  function generateStars(rating) {
    const filled = Math.min(Math.max(Math.round(rating), 0), 3);
    return "⭐".repeat(filled) + "☆".repeat(3 - filled);
  }
});
