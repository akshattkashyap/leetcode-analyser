// content.js — MutationObserver, scraping, DOM injection, button injection

(function () {
  "use strict";

  const ANALYZER_PREFIX = "lc-analyzer-";
  let isAnalyzing = false;

  // ─── Entry Point ───
  function init() {
    if (!isSubmissionPage()) return;
    waitForSubmissionContent(() => {
      injectAnalysisButton();
      observeReRenders();
    });
  }

  function isSubmissionPage() {
    return /\/problems\/[^/]+\/submissions\/\d+/.test(window.location.pathname);
  }

  // ─── Wait for LeetCode SPA to fully render the submission result ───
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

  // ─── Find the left submission panel (the scrollable container) ───
  function getSubmissionPanel() {
    const resultEl =
      document.querySelector('[data-e2e-locator="submission-result"]') ||
      findResultElement();

    if (!resultEl) return null;

    let node = resultEl.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function findResultElement() {
    const candidates = document.querySelectorAll("span, div");
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (
        el.childElementCount <= 2 &&
        (text.startsWith("Accepted") ||
          text.startsWith("Wrong Answer") ||
          text.startsWith("Time Limit Exceeded") ||
          text.startsWith("Runtime Error"))
      ) {
        return el;
      }
    }
    return null;
  }

  /**
   * Get the "content wrapper" — the element whose direct children are the
   * major visual sections (header, runtime, code, notes, etc).
   * This is either the panel itself or its first child (LeetCode often wraps
   * the scrollable content in a single div).
   */
  function getContentWrapper(panel) {
    // If the panel has very few direct children (1-2), the real content is likely
    // inside the first child. If it has many children, the panel IS the wrapper.
    const directDivChildren = Array.from(panel.children).filter(
      (c) => c.tagName === "DIV",
    );

    if (directDivChildren.length === 1) {
      // Check if that single child has many children (the actual sections)
      const inner = directDivChildren[0];
      const innerChildren = Array.from(inner.children).filter(
        (c) => c.tagName === "DIV",
      );
      if (innerChildren.length >= 3) return inner;
    }

    return panel;
  }

  /**
   * Walk the direct children of the content wrapper and classify them
   * into the major sections we care about.
   */
  function findSectionChildren(wrapper) {
    const children = Array.from(wrapper.children);
    let runtimeBlock = null;
    let codeBlock = null;

    for (const child of children) {
      // Skip our own injected elements
      if (
        child.className &&
        child.className.toString().includes(ANALYZER_PREFIX)
      )
        continue;

      const text = child.textContent || "";

      // Runtime/Memory block: contains both "Runtime" and "Memory" with units
      if (
        !runtimeBlock &&
        text.includes("Runtime") &&
        text.includes("Memory") &&
        (text.includes("ms") || text.includes("MB"))
      ) {
        runtimeBlock = child;
        continue;
      }

      // Code block: starts with "Code" and contains code content
      // Must come after the runtime block in DOM order
      if (
        !codeBlock &&
        runtimeBlock &&
        (text.startsWith("Code") || child.querySelector("code, pre"))
      ) {
        codeBlock = child;
        continue;
      }
    }

    return { runtimeBlock, codeBlock };
  }

  // ─── Re-inject if React removes our elements ───
  function observeReRenders() {
    const observer = new MutationObserver(() => {
      if (!isSubmissionPage()) return;
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
    // Monaco editor
    const monacoLines = document.querySelectorAll(".view-lines .view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((l) => l.textContent)
        .join("\n");
    }

    // Code block in left panel
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

    // Look for the "Solution" button/link inside the panel
    const links = panel.querySelectorAll("a, button");
    for (const link of links) {
      const text = link.textContent.trim();
      if (text === "Solution" || text === "Solutions") {
        const parent = link.closest("div");
        if (parent) return parent;
      }
    }

    // Fallback: find the submission result header row
    const resultEl =
      panel.querySelector('[data-e2e-locator="submission-result"]') ||
      findResultElement();

    if (resultEl) {
      let container = resultEl.parentElement;
      for (let i = 0; i < 4 && container; i++) {
        if (container.children.length >= 2) return container;
        container = container.parentElement;
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
    const { runtimeBlock } = findSectionChildren(wrapper);
    if (runtimeBlock) {
      wrapper.insertBefore(errorEl, runtimeBlock);
    } else {
      wrapper.appendChild(errorEl);
    }
  }

  // ─── DOM Injection ───
  function injectAnalysisSections(data) {
    document
      .querySelectorAll(`.${ANALYZER_PREFIX}error`)
      .forEach((el) => el.remove());

    const panel = getSubmissionPanel();
    if (!panel) return;

    const wrapper = getContentWrapper(panel);
    const { runtimeBlock, codeBlock } = findSectionChildren(wrapper);

    // === BEFORE runtime block: badges + congrats + divider + approach ===
    const beforeWrap = document.createElement("div");
    beforeWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    beforeWrap.appendChild(createBadgeRow());
    beforeWrap.appendChild(createCongrats(data.congratulations));
    beforeWrap.appendChild(createDivider());
    beforeWrap.appendChild(createApproachSection(data.approach));

    if (runtimeBlock) {
      wrapper.insertBefore(beforeWrap, runtimeBlock);
    } else {
      wrapper.appendChild(beforeWrap);
    }

    // === AFTER runtime block: efficiency ===
    const efficiencyWrap = document.createElement("div");
    efficiencyWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    efficiencyWrap.appendChild(createEfficiencySection(data.efficiency));

    if (runtimeBlock && runtimeBlock.nextSibling) {
      wrapper.insertBefore(efficiencyWrap, runtimeBlock.nextSibling);
    } else if (runtimeBlock) {
      wrapper.appendChild(efficiencyWrap);
    } else {
      wrapper.appendChild(efficiencyWrap);
    }

    // === AFTER code block: code style ===
    const codeStyleWrap = document.createElement("div");
    codeStyleWrap.className = `${ANALYZER_PREFIX}section-wrap`;
    codeStyleWrap.appendChild(createCodeStyleSection(data.code_style));

    if (codeBlock && codeBlock.nextSibling) {
      wrapper.insertBefore(codeStyleWrap, codeBlock.nextSibling);
    } else if (codeBlock) {
      wrapper.appendChild(codeStyleWrap);
    } else {
      wrapper.appendChild(codeStyleWrap);
    }
  }

  // ─── Section Builders ───
  function createBadgeRow() {
    const container = document.createElement("div");
    container.className = `${ANALYZER_PREFIX}badges`;

    ["✓ Approach", "✓ Efficiency", "✓ Code Style"].forEach((label) => {
      const badge = document.createElement("span");
      badge.className = `${ANALYZER_PREFIX}badge`;
      badge.textContent = label;
      container.appendChild(badge);
    });

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

    section.appendChild(createHeading("🧑 Approach"));
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

    section.appendChild(createHeading("⚡ Efficiency"));

    const currentComp = document.createElement("span");
    currentComp.className = `${ANALYZER_PREFIX}complexity ${ANALYZER_PREFIX}complexity-current`;
    currentComp.textContent = efficiency.current_complexity;

    const suggestedComp = document.createElement("span");
    suggestedComp.className = `${ANALYZER_PREFIX}complexity ${ANALYZER_PREFIX}complexity-suggested`;
    suggestedComp.textContent = efficiency.suggested_complexity;

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

    section.appendChild(createHeading("✂ Code Style"));
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
      tagSpan.textContent = tag;
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
  init();

  // SPA navigation handler
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (isSubmissionPage()) {
        setTimeout(() => {
          removeAnalysisSections();
          init();
        }, 2000);
      }
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
