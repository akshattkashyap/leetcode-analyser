// content.js — MutationObserver, scraping, DOM injection, button injection

(function () {
  "use strict";

  const ANALYZER_PREFIX = "lc-analyzer-";
  let isAnalyzing = false;

  // ─── Entry Point ───
  function init() {
    if (!isSubmissionPage()) return;
    waitForSubmissionContent(() => {
      hideNativeAnalysis();
      injectAnalysisButton();
      observeReRenders();
    });
  }

  // ─── Hide LeetCode's native Analysis button/tab ───
  // ONLY target tab headers (flexlayout__tabset) and specific buttons.
  // NEVER target divs inside flexlayout__tab (content panels).
  function hideNativeAnalysis() {
    // 1. Hide "Analysis" tab in the tab header bar
    const tabsets = document.querySelectorAll(".flexlayout__tabset");
    for (const tabset of tabsets) {
      // Only look at direct tab button elements, not deep content
      const tabButtons = tabset.querySelectorAll(
        '[class*="flexlayout__tab_button"], [role="tab"]',
      );
      for (const btn of tabButtons) {
        const text = btn.textContent.trim();
        if (text === "Analysis" || text === "✦ Analysis") {
          btn.style.display = "none";
        }
      }
    }

    // 2. Hide native Analysis buttons/links inside the submission panel
    const panel = getSubmissionPanel();
    if (!panel) return;
    const buttons = panel.querySelectorAll("button, a");
    for (const btn of buttons) {
      if (btn.classList.contains(`${ANALYZER_PREFIX}btn`)) continue;
      const text = btn.textContent.trim();
      if (text === "Analysis" || text === "✦ Analysis") {
        btn.style.display = "none";
      }
    }
  }

  function isSubmissionPage() {
    return /\/problems\/[^/]+\/submissions\/\d+/.test(window.location.pathname);
  }

  // ─── Wait for LeetCode SPA to fully render ───
  function waitForSubmissionContent(callback, maxWait = 20000) {
    const check = () => getSubmissionPanel() !== null;
    if (check()) return callback();

    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
        callback();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), maxWait);
  }

  // ─── Find the left submission panel ───
  // The panel is: flexlayout__tab > div > div.overflow-y-auto > div.mx-auto
  // We target the "mx-auto" content container directly.
  function getSubmissionPanel() {
    // Strategy: find the "overflow-y-auto" scrollable container inside flexlayout
    const scrollContainers = document.querySelectorAll(".overflow-y-auto");
    for (const container of scrollContainers) {
      // Check it's inside a flexlayout__tab
      const tab = container.closest(".flexlayout__tab");
      if (!tab) continue;

      // Check it contains submission result text
      const text = container.textContent || "";
      if (
        text.includes("Accepted") ||
        text.includes("Wrong Answer") ||
        text.includes("Time Limit Exceeded") ||
        text.includes("Runtime Error") ||
        text.includes("Memory Limit Exceeded") ||
        text.includes("Compile Error")
      ) {
        return container;
      }
    }
    return null;
  }

  /**
   * Get the content wrapper inside the scroll panel.
   * Structure: overflow-y-auto > div.mx-auto.max-w-[700px].flex-col.gap-4
   */
  function getContentWrapper(panel) {
    // The mx-auto wrapper is the first (and usually only) child
    const mxAuto = panel.querySelector('[class*="mx-auto"]');
    if (mxAuto) return mxAuto;

    // Fallback: first div child
    const firstChild = panel.querySelector(":scope > div");
    return firstChild || panel;
  }

  /**
   * Find runtime/memory block and code block within the wrapper's tree.
   * Searches ALL children of the wrapper (not just the first) since the
   * DOM structure can differ between accepted and failed submissions.
   */
  function findLandmarks(wrapper) {
    let runtimeBlock = null;
    let codeBlock = null;

    const walkChildren = (parent, depth) => {
      if (depth > 3) return;
      for (const child of parent.children) {
        if (child.className?.toString().includes(ANALYZER_PREFIX)) continue;
        const text = child.textContent || "";

        // Runtime/Memory block
        if (
          !runtimeBlock &&
          text.includes("Runtime") &&
          text.includes("Memory") &&
          (text.includes("ms") || text.includes("MB")) &&
          text.includes("Beats")
        ) {
          runtimeBlock = child;
          continue;
        }

        // Code block — first text starts with "Code"
        if (!codeBlock) {
          const firstEl = child.querySelector(":scope > div, :scope > span");
          const firstText = firstEl ? firstEl.textContent.trim() : "";
          if (firstText.startsWith("Code")) {
            codeBlock = child;
            continue;
          }
        }

        // Recurse deeper if we haven't found both yet
        if (!runtimeBlock || !codeBlock) {
          walkChildren(child, depth + 1);
        }
      }
    };

    // Walk ALL children of the wrapper
    walkChildren(wrapper, 0);

    return { runtimeBlock, codeBlock };
  }

  // ─── Re-inject if React removes our elements ───
  function observeReRenders() {
    const observer = new MutationObserver(() => {
      if (!isSubmissionPage()) return;
      hideNativeAnalysis();
      if (!document.querySelector(`.${ANALYZER_PREFIX}btn`)) {
        injectAnalysisButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Scraping ───
  function scrapeProblemTitle() {
    const titleLink = document.querySelector('a[href*="/problems/"] span');
    if (titleLink) return titleLink.textContent.trim();

    const match = document.title.match(/^(.*?)\s*[-–|]/);
    if (match) return match[1].trim();

    const urlMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    if (urlMatch) return urlMatch[1].replace(/-/g, " ");

    return "Unknown Problem";
  }

  function scrapeLanguage() {
    const panel = getSubmissionPanel();
    const scope = panel || document;

    const allEls = scope.querySelectorAll("span, div, button");
    for (const el of allEls) {
      const text = el.textContent.trim();
      if (
        /^(C\+\+|Java|Python|Python3|JavaScript|TypeScript|Go|Rust|Swift|Kotlin|Ruby|Scala|C#|C|PHP|Dart)$/i.test(
          text,
        )
      ) {
        return text;
      }
    }
    return "Unknown";
  }

  function scrapeCode() {
    const monacoLines = document.querySelectorAll(".view-lines .view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((l) => l.textContent)
        .join("\n");
    }

    const panel = getSubmissionPanel();
    if (panel) {
      const codeBlock = panel.querySelector("code, pre code");
      if (codeBlock) return codeBlock.textContent.trim();
      const pres = panel.querySelectorAll("pre");
      for (const pre of pres) {
        if (pre.textContent.length > 30) return pre.textContent.trim();
      }
    }

    const codeBlock = document.querySelector("code, pre code");
    if (codeBlock) return codeBlock.textContent.trim();

    return null;
  }

  // ─── Analysis Button Injection ───
  function injectAnalysisButton() {
    if (document.querySelector(`.${ANALYZER_PREFIX}btn`)) return;

    const headerArea = findButtonArea();
    if (!headerArea) return;

    const btn = document.createElement("button");
    btn.className = `${ANALYZER_PREFIX}btn`;
    btn.innerHTML = "✦ Analysis";
    btn.addEventListener("click", handleAnalysisClick);
    headerArea.appendChild(btn);
  }

  function findButtonArea() {
    const panel = getSubmissionPanel();
    if (!panel) return null;

    // Look for Solution / Editorial button
    const links = panel.querySelectorAll("a, button");
    for (const link of links) {
      const text = link.textContent.trim();
      if (text === "Solution" || text === "Solutions" || text === "Editorial") {
        const parent = link.closest("div");
        if (parent) return parent;
      }
    }

    // Fallback: find submission result header
    const allSpans = panel.querySelectorAll("span, div");
    for (const el of allSpans) {
      const text = el.textContent.trim();
      if (
        (text.startsWith("Accepted") ||
          text.startsWith("Wrong Answer") ||
          text.startsWith("Time Limit") ||
          text.startsWith("Runtime Error")) &&
        el.childElementCount <= 3
      ) {
        let container = el.parentElement;
        for (let i = 0; i < 4 && container; i++) {
          if (container.children.length >= 2) return container;
          container = container.parentElement;
        }
      }
    }

    return null;
  }

  // ─── Analysis Handler ───
  async function handleAnalysisClick() {
    if (isAnalyzing) return;

    const btn = document.querySelector(`.${ANALYZER_PREFIX}btn`);
    if (!btn) return;

    removeAnalysisSections();

    isAnalyzing = true;
    btn.disabled = true;
    btn.innerHTML = `<span class="${ANALYZER_PREFIX}spinner"></span> Analyzing...`;
    btn.classList.add(`${ANALYZER_PREFIX}btn-active`);

    const problemTitle = scrapeProblemTitle();
    const language = scrapeLanguage();
    const code = scrapeCode();

    if (!code) {
      showError("Could not scrape code from the page.");
      resetButton(btn);
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: "analyzeCode",
        data: { problemTitle, language, code },
      });

      if (response.error) {
        showError(response.error);
      } else {
        injectAnalysisSections(response.result);
      }
    } catch (err) {
      showError("Failed to communicate with extension. Reload the page.");
    }

    resetButton(btn);
  }

  function resetButton(btn) {
    isAnalyzing = false;
    btn.disabled = false;
    btn.innerHTML = "✦ Analysis";
    btn.classList.remove(`${ANALYZER_PREFIX}btn-active`);
  }

  // ─── Remove Previous Analysis ───
  function removeAnalysisSections() {
    document
      .querySelectorAll(
        `.${ANALYZER_PREFIX}section-wrap, .${ANALYZER_PREFIX}error`,
      )
      .forEach((el) => el.remove());
  }

  // ─── Error Display ───
  function showError(message) {
    document
      .querySelectorAll(`.${ANALYZER_PREFIX}error`)
      .forEach((el) => el.remove());

    const panel = getSubmissionPanel();
    if (!panel) return;

    const errorEl = document.createElement("div");
    errorEl.className = `${ANALYZER_PREFIX}error`;
    errorEl.textContent = `⚠ ${message}`;

    const wrapper = getContentWrapper(panel);
    wrapper.appendChild(errorEl);
  }

  // ─── DOM Injection ───
  function injectAnalysisSections(data) {
    document
      .querySelectorAll(`.${ANALYZER_PREFIX}error`)
      .forEach((el) => el.remove());

    const panel = getSubmissionPanel();
    if (!panel) return;

    const wrapper = getContentWrapper(panel);
    const { runtimeBlock, codeBlock } = findLandmarks(wrapper);

    // Build all three section wrappers
    const approachWrap = document.createElement("div");
    approachWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    approachWrap.appendChild(createBadgeRow(!!runtimeBlock));
    approachWrap.appendChild(createCongrats(data.congratulations));
    approachWrap.appendChild(createDivider());
    approachWrap.appendChild(createApproachSection(data.approach));

    const efficiencyWrap = document.createElement("div");
    efficiencyWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    efficiencyWrap.appendChild(createEfficiencySection(data.efficiency));

    const codeStyleWrap = document.createElement("div");
    codeStyleWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    codeStyleWrap.appendChild(createCodeStyleSection(data.code_style));

    if (runtimeBlock) {
      // ─── ACCEPTED: interleave with native sections ───
      runtimeBlock.parentElement.insertBefore(approachWrap, runtimeBlock);
      insertAfter(efficiencyWrap, runtimeBlock);

      if (codeBlock) {
        insertAfter(codeStyleWrap, codeBlock);
      } else {
        wrapper.appendChild(codeStyleWrap);
      }
    } else {
      // ─── FAILED: interleave around the code block ───
      if (codeBlock) {
        codeBlock.parentElement.insertBefore(approachWrap, codeBlock);
        codeBlock.parentElement.insertBefore(efficiencyWrap, codeBlock);
        insertAfter(codeStyleWrap, codeBlock);
      } else {
        // Last resort: append to wrapper
        wrapper.appendChild(approachWrap);
        wrapper.appendChild(efficiencyWrap);
        wrapper.appendChild(codeStyleWrap);
      }
    }
  }

  function insertAfter(newNode, referenceNode) {
    if (referenceNode.nextSibling) {
      referenceNode.parentElement.insertBefore(
        newNode,
        referenceNode.nextSibling,
      );
    } else {
      referenceNode.parentElement.appendChild(newNode);
    }
  }

  // ─── Section Builders ───
  function createBadgeRow(isAccepted) {
    const container = document.createElement("div");
    container.className = `${ANALYZER_PREFIX}badges`;

    const icon = isAccepted ? "✓" : "✗";
    [`${icon} Approach`, `${icon} Efficiency`, `${icon} Code Style`].forEach(
      (label) => {
        const badge = document.createElement("span");
        badge.className = `${ANALYZER_PREFIX}badge`;
        badge.textContent = label;
        container.appendChild(badge);
      },
    );

    return container;
  }

  function createCongrats(text) {
    const el = document.createElement("div");
    el.className = `${ANALYZER_PREFIX}congrats`;
    el.textContent = text;
    return el;
  }

  function createDivider() {
    const hr = document.createElement("hr");
    hr.className = `${ANALYZER_PREFIX}divider`;
    return hr;
  }

  function createApproachSection(approach) {
    const section = document.createElement("div");
    section.className = `${ANALYZER_PREFIX}section`;

    section.appendChild(createHeading("Approach"));
    section.appendChild(
      createRow("Current:", createTags(approach.current_tags)),
    );
    section.appendChild(
      createRow("Suggested:", createTags(approach.suggested_tags)),
    );
    section.appendChild(
      createRow("Key Idea:", createTextValue(approach.key_idea)),
    );

    return section;
  }

  function createEfficiencySection(efficiency) {
    const section = document.createElement("div");
    section.className = `${ANALYZER_PREFIX}section`;

    section.appendChild(createHeading("Efficiency"));

    const currentComp = document.createElement("span");
    currentComp.className = `${ANALYZER_PREFIX}complexity ${ANALYZER_PREFIX}complexity-current`;
    currentComp.textContent = efficiency.current_complexity.toUpperCase();

    const suggestedComp = document.createElement("span");
    suggestedComp.className = `${ANALYZER_PREFIX}complexity ${ANALYZER_PREFIX}complexity-suggested`;
    suggestedComp.textContent = efficiency.suggested_complexity.toUpperCase();

    section.appendChild(createRow("Current complexity:", currentComp));
    section.appendChild(createRow("Suggested complexity:", suggestedComp));
    section.appendChild(
      createRow("Suggestions:", createTextValue(efficiency.suggestion)),
    );

    return section;
  }

  function createCodeStyleSection(codeStyle) {
    const section = document.createElement("div");
    section.className = `${ANALYZER_PREFIX}section`;

    section.appendChild(createHeading("Code Style"));
    section.appendChild(
      createRow("Readability:", createStars(codeStyle.readability)),
    );
    section.appendChild(
      createRow("Structure:", createStars(codeStyle.structure)),
    );

    const suggestion = createTextValue(codeStyle.suggestion);
    suggestion.classList.add(`${ANALYZER_PREFIX}suggestion-purple`);
    section.appendChild(createRow("Suggestions:", suggestion));

    return section;
  }

  // ─── Helpers ───
  function createHeading(text) {
    const h = document.createElement("div");
    h.className = `${ANALYZER_PREFIX}section-heading`;
    h.textContent = text;
    return h;
  }

  function createRow(label, valueEl) {
    const row = document.createElement("div");
    row.className = `${ANALYZER_PREFIX}row`;

    const labelSpan = document.createElement("span");
    labelSpan.className = `${ANALYZER_PREFIX}row-label`;
    labelSpan.textContent = label;

    row.appendChild(labelSpan);
    row.appendChild(valueEl);
    return row;
  }

  function createTextValue(text) {
    const span = document.createElement("span");
    span.className = `${ANALYZER_PREFIX}row-value`;
    span.textContent = text;
    return span;
  }

  function createTags(tags) {
    const container = document.createElement("span");
    container.className = `${ANALYZER_PREFIX}row-value`;

    tags.forEach((tag, i) => {
      const tagSpan = document.createElement("span");
      tagSpan.className = `${ANALYZER_PREFIX}tag`;
      tagSpan.textContent = tag.replace(/\b\w/g, (c) => c.toUpperCase());
      container.appendChild(tagSpan);

      if (i < tags.length - 1) {
        const sep = document.createElement("span");
        sep.className = `${ANALYZER_PREFIX}tag-separator`;
        sep.textContent = " / ";
        container.appendChild(sep);
      }
    });

    return container;
  }

  function createStars(rating) {
    const container = document.createElement("span");
    container.className = `${ANALYZER_PREFIX}stars`;
    const filled = Math.min(Math.max(Math.round(rating), 0), 3);
    container.textContent = "⭐".repeat(filled) + "☆".repeat(3 - filled);
    return container;
  }

  // ─── Start ───
  console.log("[LC-Analyzer] Content script loaded on:", location.href);
  init();

  // Persistent watcher — check every 1.5s if submission panel exists
  setInterval(() => {
    const isSub = isSubmissionPage();
    const panel = getSubmissionPanel();
    const btnExists = !!document.querySelector(`.${ANALYZER_PREFIX}btn`);

    console.log("[LC-Analyzer] poll:", {
      url: location.href,
      isSub,
      panelFound: !!panel,
      btnExists,
    });

    if (!isSub) return;
    if (!panel) return;

    if (!btnExists) {
      console.log("[LC-Analyzer] Injecting button...");
      hideNativeAnalysis();
      injectAnalysisButton();
    }

    hideNativeAnalysis();
  }, 1500);
})();
