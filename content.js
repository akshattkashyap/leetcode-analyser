// content.js — Scrapes problem description and code from LeetCode

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractData") {
    try {
      // 1. Get Problem Title
      // Usually the URL looks like /problems/two-sum/
      const pathParts = window.location.pathname.split('/');
      let questionTitle = "Unknown Problem";
      if (pathParts[1] === 'problems' && pathParts[2]) {
        questionTitle = pathParts[2].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      } else {
        const titleEl = document.querySelector('a[href^="/problems/"]');
        if (titleEl) questionTitle = titleEl.textContent;
      }

      // 2. Get Problem Description
      let question = "";
      const descEl = document.querySelector('[data-track-load="description_content"]');
      if (descEl) {
        question = descEl.innerText;
      } else {
        question = "Description not found. Ensure you are on the problem description tab.";
      }

      // 3. Get Language
      let language = "Unknown";
      const langBtn = document.querySelector('button[id^="headlessui-listbox-button"]');
      if (langBtn) {
        language = langBtn.textContent;
      }

      // 4. Get Code
      // LeetCode uses Monaco Editor. We can't access `window.monaco` directly from 
      // the content script's isolated world, so we inject a script to the main world.
      
      const scriptId = 'lc-analyzer-injector';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.textContent = `
          // Listen for events from content script
          document.addEventListener('lc-extract-code', () => {
            let extractedCode = "";
            try {
              // Try to find Monaco instances
              if (window.monaco && window.monaco.editor) {
                const models = window.monaco.editor.getModels();
                if (models && models.length > 0) {
                  // Usually the active editor is the first or last model
                  extractedCode = models.map(m => m.getValue()).find(c => c.length > 10) || models[0].getValue();
                }
              }
            } catch (e) {
              console.error("[LC-Analyzer] Monaco extraction failed:", e);
            }
            
            // Send back to content script
            document.dispatchEvent(new CustomEvent('lc-code-extracted', { detail: { code: extractedCode } }));
          });
        `;
        document.body.appendChild(script);
      }

      // Setup one-time listener for the injected script's response
      const messageHandler = (event) => {
        clearTimeout(timeoutId);
        document.removeEventListener('lc-code-extracted', messageHandler);
        
        let code = event.detail ? event.detail.code : "";
        if (!code || code.trim() === "") {
          // Fallback: Scraping from DOM `.view-line` elements
          const lines = Array.from(document.querySelectorAll('.view-line'));
          code = lines.map(line => line.textContent).join('\n');
          if (!code) code = "Code not found. Please ensure the editor is visible.";
        }

        sendResponse({ questionTitle, question, language, code });
      };

      document.addEventListener('lc-code-extracted', messageHandler);

      // Trigger the extraction (add timeout in case it fails)
      const timeoutId = setTimeout(() => {
        document.removeEventListener('lc-code-extracted', messageHandler);
        // Fallback if event never fires
        const lines = Array.from(document.querySelectorAll('.view-line'));
        const code = lines.map(line => line.textContent).join('\n') || "Code extraction timed out.";
        sendResponse({ questionTitle, question, language, code });
      }, 2000);

      document.dispatchEvent(new CustomEvent('lc-extract-code'));

      return true; // Keep message channel open for async sendResponse

    } catch (e) {
      console.error("[LC-Analyzer] Extraction Error:", e);
      sendResponse({ error: e.message });
    }
  }
});
