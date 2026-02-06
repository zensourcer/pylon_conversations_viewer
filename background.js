/**
 * background.js — MV3 Service Worker
 * Manages popup window lifecycle and responds to conversation navigation.
 */

let lastHandledId = null;
let isCreating = false;

async function getPopupWindowId() {
  const { _popupWinId } = await chrome.storage.session.get("_popupWinId");
  return _popupWinId ?? null;
}

async function setPopupWindowId(id) {
  if (id !== null) {
    await chrome.storage.session.set({ _popupWinId: id });
  } else {
    await chrome.storage.session.remove("_popupWinId");
  }
}

async function openOrFocusWindow() {
  if (isCreating) return;
  isCreating = true;

  try {
    const windowId = await getPopupWindowId();
    if (windowId !== null) {
      try {
        await chrome.windows.update(windowId, { focused: true });
        const tabs = await chrome.tabs.query({ windowId });
        if (tabs.length > 0) chrome.tabs.reload(tabs[0].id);
        return;
      } catch {
        await setPopupWindowId(null);
      }
    }

    const win = await chrome.windows.create({
      url: chrome.runtime.getURL("popup.html"),
      type: "popup",
      width: 480,
      height: 680,
      focused: true,
    });
    await setPopupWindowId(win.id);
    await chrome.windows.update(win.id, { focused: true });
  } finally {
    isCreating = false;
  }
}

chrome.windows.onRemoved.addListener(async (id) => {
  const current = await getPopupWindowId();
  if (id === current) await setPopupWindowId(null);
});

chrome.action.onClicked.addListener(openOrFocusWindow);

async function handleConversation(id) {
  if (id === lastHandledId) return;
  lastHandledId = id;
  await chrome.storage.session.set({ conversationId: id });
  chrome.action.setBadgeText({ text: "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  await openOrFocusWindow();
}

// Full-page navigation (e.g., link opening in new tab)
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  try {
    const id = new URL(details.url).searchParams.get("conversationID");
    if (!id) return;

    // Close source tab if it's not the last tab
    try {
      const tab = await chrome.tabs.get(details.tabId);
      const siblings = await chrome.tabs.query({ windowId: tab.windowId });
      if (siblings.length > 1) await chrome.tabs.remove(details.tabId);
    } catch {}

    await handleConversation(id);
  } catch {}
}, { urlFilter: [{ urlContains: "conversationID" }] });

// Content script signal via storage (most reliable)
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  if (!changes._popupTrigger?.newValue) return;
  const { id } = changes._popupTrigger.newValue;
  await handleConversation(id);
});

// Messages from content script (fast path)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CONVERSATION_CLICKED") {
    handleConversation(msg.id)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "SET_CONVERSATION_ID") {
    chrome.storage.session.set({ conversationId: msg.id });
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "GET_STATE") {
    chrome.storage.session.get(["conversationId", "token"]).then(sendResponse);
    return true;
  }

  if (msg.type === "SET_TOKEN") {
    chrome.storage.session.set({ token: msg.token });
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "CLEAR_TOKEN") {
    chrome.storage.session.remove("token");
    sendResponse({ ok: true });
    return;
  }

  sendResponse(null);
});
