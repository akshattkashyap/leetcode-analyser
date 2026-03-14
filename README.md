# LeetCode Analyzer

A Chrome extension that provides AI-powered analysis of your LeetCode solutions using the [Groq API](https://groq.com/). Get instant feedback on your approach, efficiency, and code style — all from a convenient side panel while you're solving problems.

---

## Features

- **Approach Analysis** — Identifies the algorithm or pattern you used, suggests alternatives, and asks thought-provoking questions to guide improvement.
- **Efficiency Analysis** — Evaluates your time and space complexity and suggests optimizations.
- **Code Style Analysis** — Rates readability and structure (0–3 stars each) and offers concrete improvement tips.
- **Encouragement** — Personalised congratulations message based on solution quality.
- **Automatic Code Extraction** — Reads your code directly from LeetCode's Monaco Editor — no copy-paste needed.
- **Secure API Key Storage** — Your Groq API key is saved locally in Chrome's storage; it never leaves your browser except when calling the Groq API.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Extension standard | Chrome Manifest V3 |
| Language | Vanilla JavaScript (no build step) |
| Styling | Custom CSS (dark theme) |
| AI backend | [Groq API](https://console.groq.com/) |
| Target site | [LeetCode.com](https://leetcode.com) |

---

## Prerequisites

- **Google Chrome** 126 or later
- A **Groq API key** — sign up for free at <https://console.groq.com/> and generate a key (it starts with `gsk_`)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/akshattkashyap/leetcode-analyser.git
cd leetcode-analyser
```

> No `npm install` or build step is required — the extension runs directly from the source files.

### 2. Load the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the root folder of this repository (the one containing `manifest.json`).

The *LeetCode Analyzer* icon will appear in your Chrome toolbar.

### 3. Configure your Groq API key

1. Click the extension icon to open the side panel.
2. Click the **⚙ Settings** gear icon.
3. Paste your Groq API key into the input field.
4. Click **Save Key**.

---

## Usage

1. Open any LeetCode problem page, e.g. `https://leetcode.com/problems/two-sum/`.
2. Write your solution in the editor.
3. Click the **LeetCode Analyzer** extension icon — the side panel opens automatically.
4. The extension extracts your code and sends it for analysis.
5. Review the AI-generated feedback in the four sections: **Approach**, **Efficiency**, **Code Style**, and the personalised **Congratulations** message.

If analysis fails (e.g. API error or no code found), an error message is shown with a **Retry** button.

---

## Project Structure

```
leetcode-analyser/
├── manifest.json        # Chrome extension manifest (Manifest V3)
├── background.js        # Service worker — handles Groq API calls
├── content.js           # Content script — extracts code from LeetCode pages
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── sidepanel/
    ├── sidepanel.html   # Side panel markup
    ├── sidepanel.css    # Side panel styling
    └── sidepanel.js     # Side panel logic and result rendering
```

---

## How It Works

```
LeetCode page
    │
    ▼
content.js          ← injected into https://leetcode.com/problems/*
  Extracts: problem title, description, language, code (via Monaco API)
    │
    ▼
sidepanel.js        ← running in the Chrome side panel
  Sends "analyzeCode" message to background worker
    │
    ▼
background.js       ← Manifest V3 service worker
  Reads Groq API key from chrome.storage.local
  Calls POST https://api.groq.com/openai/v1/chat/completions
    │
    ▼
Groq API            ← returns structured JSON analysis
    │
    ▼
sidepanel.js        ← renders results (approach, efficiency, style, encouragement)
```

### Chrome Permissions Used

| Permission | Purpose |
|------------|---------|
| `storage` | Store the Groq API key locally |
| `activeTab`, `tabs` | Identify the active LeetCode tab |
| `sidePanel` | Open and control the side panel |
| `scripting` | Inject helper scripts to read Monaco Editor state |
| `host_permissions: https://api.groq.com/*` | Allow API calls to Groq |

---

## Configuration

All configuration is done through the extension's Settings screen. No `.env` file or server-side setup is required.

| Setting | Description |
|---------|-------------|
| **Groq API Key** | Your personal key from <https://console.groq.com/>. Stored in `chrome.storage.local` under the key `groq_api_key`. |

The Groq model and request parameters are configured in `background.js`:

```js
model: "openai/gpt-oss-120b"
temperature: 0.7
response_format: { type: "json_object" }
```

---

## Contributing

Contributions are welcome! Please open an issue or pull request.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Commit your changes: `git commit -m "feat: add my feature"`.
4. Push to your fork and open a pull request.

---

## License

This project is open source. See the repository for license details.
