/**
 * content.js — Detects conversation navigation on app.usepylon.com
 * Signals background via message (fast) + storage write (reliable fallback)
 */
(function () {
  let lastReportedId = null;
  let clickPending = false;

  function extractId(url) {
    try {
      const params = new URL(url).searchParams;
      return params.get("conversationID") ?? params.get("issueNumber");
    } catch {
      return null;
    }
  }

  function notifyBackground(fromClick, id) {
    // Fast path: direct message
    try {
      chrome.runtime.sendMessage({
        type: fromClick ? "CONVERSATION_CLICKED" : "SET_CONVERSATION_ID",
        id
      }).catch(() => {});
    } catch {}

    // Reliable path: storage write wakes suspended service worker
    if (fromClick) {
      chrome.storage.local.set({ _popupTrigger: { id, ts: Date.now() } }).catch(() => {});
    }
  }

  function checkUrl(fromClick) {
    const id = extractId(window.location.href);
    if (!id || id === lastReportedId) return;
    lastReportedId = id;
    notifyBackground(fromClick, id);
  }

  // Initial page load with conversationID → open popup
  checkUrl(true);

  // Click detection
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (link) {
      const href = link.getAttribute("href");
      if (href) {
        try {
          const id = extractId(new URL(href, window.location.origin).href);
          if (id) {
            e.preventDefault();
            if (id !== lastReportedId) {
              lastReportedId = id;
              notifyBackground(true, id);
            }
            return;
          }
        } catch {}
      }
    }

    // Set flag for pushState detection
    clickPending = true;
    setTimeout(() => { clickPending = false; }, 300);
  }, { capture: true });

  // SPA navigation detection
  ["pushState", "replaceState"].forEach((method) => {
    const orig = history[method].bind(history);
    history[method] = function (...args) {
      orig(...args);
      queueMicrotask(() => checkUrl(clickPending));
    };
  });

  // Browser back/forward
  window.addEventListener("popstate", () => checkUrl(true));
})();
