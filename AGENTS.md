# AGENTS.md

## What This Is
Chrome extension that injects AI-generated analysis sections into LeetCode submission pages using the Groq API.

## Stack
- Manifest v3
- Vanilla JS (no bundler, no framework)
- Groq API — model: `openai/gpt-oss-120b`
- API key stored in `chrome.storage.local` under `groq_api_key`

## Conventions
- All injected DOM elements must use `lc-analyzer-` class prefix
- Never fetch from content.js — all API calls go through background.js (service worker)
- Never touch LeetCode's existing DOM elements, only inject around them
- Injected sections must be re-injectable — LeetCode's React will unmount them

## Key Files
| File | Role |
|---|---|
| `content.js` | Scraping, button injection, DOM injection, MutationObserver |
| `background.js` | Groq API call, chrome.storage read |
| `styles.css` | All injected UI styles, scoped to `lc-analyzer-*` |
| `popup/popup.js` | API key save/load UI |

## Do Not
- Do not alert() on errors — inject inline error div
- Do not inject on page load — only on button click
- Do not scrape or modify runtime/memory values
- Do not add global CSS overrides