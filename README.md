# ✦ LeetCode Analyzer

> AI-powered Chrome extension that analyzes your LeetCode submissions in real time — right inside a side panel.

<p align="center">
  <img src="icons/icon128.png" alt="LeetCode Analyzer icon" width="96" />
</p>

---

## ✨ Features

| Feature | Details |
|---|---|
| **AI Analysis** | Powered by the [Groq](https://groq.com) API (`openai/gpt-oss-120b`) for lightning-fast feedback |
| **Side Panel UI** | Opens as a Chrome Side Panel — no popups, no new tabs |
| **Approach Review** | Shows current & suggested algorithm tags, key idea, and things to consider |
| **Efficiency Check** | Compares your current time/space complexity against the optimal |
| **Code Style Score** | Rates readability & structure on a 3-star scale with actionable suggestions |
| **Auto-Analysis** | Automatically runs when you open the panel on a LeetCode problem page |
| **Retry on Failure** | Persistent error messages with a one-click **Retry** button |

---

## 📥 Installation

### Option A — Download from Releases (Recommended)

1. Go to the [**Releases**](../../releases) page of this repository.
2. Find the latest release.
3. **Right-click** the `.crx` file → **"Save link as…"** and save it to your computer.
4. Open **Chrome** and navigate to `chrome://extensions`.
5. Enable **Developer mode** (toggle in the top-right corner).
6. **Drag and drop** the downloaded `.crx` file onto the `chrome://extensions` page.
7. Confirm the installation when prompted.

### Option B — Load Unpacked (for development)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/akshattkashyap/leetcode-analyser.git
   ```
2. Open **Chrome** → navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **"Load unpacked"** and select the cloned project folder.

---

## 🔑 Setup

1. Get a free API key from [**Groq Console**](https://console.groq.com/keys).
2. Click the **LeetCode Analyzer** extension icon in Chrome to open the side panel.
3. Paste your Groq API key in the input field and click **Save Key**.
4. Navigate to any [LeetCode problem](https://leetcode.com/problems/) — analysis runs automatically!

---

## 🚀 Usage

1. Open any LeetCode problem page (e.g. `leetcode.com/problems/two-sum`).
2. Write or paste your solution in the editor.
3. Click the **LeetCode Analyzer** icon in the toolbar to open the side panel.
4. The extension will automatically:
   - Extract the problem description and your code
   - Send it to Groq's API for analysis
   - Display results with pass/fail badges, complexity comparison, and style ratings

> **Tip:** If the analysis fails (e.g. network issue), hit the **Retry** button that appears.

---

## 🏗️ Architecture

```
leetcode-analyser/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker — handles Groq API calls
├── content.js             # Content script — scrapes problem & code from LeetCode
├── icons/                 # Extension icons (16, 48, 128 px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── sidepanel/
    ├── sidepanel.html     # Side panel markup
    ├── sidepanel.js       # UI logic, rendering, and chrome messaging
    └── sidepanel.css      # Dark-themed styles for the side panel
```

| Component | Responsibility |
|---|---|
| `content.js` | Injected into LeetCode pages. Extracts the problem title, description, language, and code (via Monaco editor API with DOM fallback). |
| `background.js` | Service worker that reads the Groq API key from `chrome.storage.local` and makes the API call. No API calls happen in content scripts. |
| `sidepanel/` | The full side panel UI — settings, status messages, and rendered analysis results. |

---

## 🛡️ Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Persisting the Groq API key locally |
| `activeTab` | Accessing the current LeetCode tab to extract code |
| `sidePanel` | Rendering the analysis UI in Chrome's side panel |
| `scripting` | Injecting the content script when needed |
| `tabs` | Querying open LeetCode tabs to find the active one |
| `host_permissions` (`api.groq.com`) | Making API calls to Groq |
