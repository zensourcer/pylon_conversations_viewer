/**
 * popup.js — Pylon conversation viewer
 * Token: session storage > config.json
 * ConvID: auto-detected from background or manual input
 */
(async () => {
  const els = {
    tokenBar: document.getElementById("token-bar"),
    tokenPanel: document.getElementById("token-panel"),
    tokenInput: document.getElementById("token-input"),
    tokenSave: document.getElementById("token-save"),
    convInput: document.getElementById("conv-input"),
    fetchBtn: document.getElementById("fetch-btn"),
    convMeta: document.getElementById("conv-meta"),
    status: document.getElementById("status"),
    messages: document.getElementById("messages"),
    refreshBtn: document.getElementById("refresh-btn"),
    rawSection: document.getElementById("raw-section"),
    rawToggle: document.getElementById("raw-toggle"),
    rawOutput: document.getElementById("raw-output"),
  };

  let token = null;
  let tokenSource = null;

  function msg(type, extra = {}) {
    return new Promise((res) => {
      chrome.runtime.sendMessage({ type, ...extra }, (response) => {
        if (chrome.runtime.lastError) { res(null); return; }
        res(response);
      });
    });
  }

  async function loadConfigToken() {
    try {
      const res = await fetch(chrome.runtime.getURL("config.json") + "?" + Date.now());
      const conf = await res.json();
      const t = conf?.bearer_token;
      return t && t !== "YOUR_TOKEN_HERE" ? t : null;
    } catch {
      return null;
    }
  }

  function renderTokenBar(source) {
    const hint = source === "session" ? "session" : "config.json";
    els.tokenBar.className = "token-bar ok";
    els.tokenBar.innerHTML =
      '<span class="token-dot"></span>' +
      '<span class="token-bar-text">Token active</span>' +
      '<span class="token-bar-hint">' + hint + '</span>' +
      '<button class="token-change" id="token-change">Change</button>';
    document.getElementById("token-change").addEventListener("click", showTokenInput);
  }

  function showTokenInput() {
    els.tokenBar.classList.add("hidden");
    els.tokenPanel.classList.remove("hidden");
    els.tokenInput.value = "";
    els.tokenInput.focus();
  }

  function showTokenBar() {
    els.tokenBar.classList.remove("hidden");
    els.tokenPanel.classList.add("hidden");
  }

  function showLoading(txt) {
    els.status.className = "status loading";
    els.status.innerHTML = '<span class="spinner"></span>' + txt;
  }

  function showError(txt) {
    els.status.className = "status error";
    els.status.textContent = txt;
  }

  function clearStatus() {
    els.status.className = "status hidden";
    els.status.innerHTML = "";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(raw) {
    if (!raw) return "";
    try {
      return new Date(raw).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return String(raw);
    }
  }

  function getInitials(name) {
    return String(name)
      .split(/\s+/)
      .map((n) => n[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  }

  function getAvatarUrl(m) {
    const s = m.sender || m.author || m.from || m.contact || {};
    return (
      s.avatar_url || s.photo_url || s.photo || s.avatar ||
      s.image_url || s.image || m.avatar_url || m.photo_url || null
    );
  }

  function getSenderName(m) {
    const s = m.sender || m.author || m.from || m.contact || {};
    return s.name || s.display_name || s.full_name || s.email || m.role || "Unknown";
  }

  function createAvatarEl(url, name, type) {
    const wrap = document.createElement("div");
    wrap.className = "msg-avatar-wrap";

    if (url) {
      const img = document.createElement("img");
      img.className = "msg-avatar";
      img.src = url;
      img.alt = name;
      img.onerror = () => img.replaceWith(fallbackAvatar(name, type));
      wrap.appendChild(img);
    } else {
      wrap.appendChild(fallbackAvatar(name, type));
    }
    return wrap;
  }

  function fallbackAvatar(name, type) {
    const div = document.createElement("div");
    div.className = "msg-avatar-fallback " + type;
    div.textContent = getInitials(name);
    return div;
  }

  function renderMessages(data) {
    els.rawOutput.textContent = JSON.stringify(data, null, 2);
    els.rawSection.classList.remove("hidden");

    let list = Array.isArray(data)
      ? data
      : (data?.messages ?? data?.data ?? data?.results ?? null);
    if (!Array.isArray(list)) list = list ? [list] : [];

    els.messages.innerHTML = "";

    if (list.length === 0) {
      els.messages.className = "messages empty-state";
      els.messages.textContent = "No messages in this conversation.";
      return;
    }

    els.messages.className = "messages";

    list.forEach((m) => {
      const type = (m.message_type || m.type || m.role || "unknown").toLowerCase();
      const sender = getSenderName(m);
      const avatarUrl = getAvatarUrl(m);
      const messageHtml = m.message_html || null;
      const body =
        m.body || m.content || m.text || m.message || m.description ||
        m.payload?.body || m.payload?.content || "";
      const time = formatDate(
        m.created_at || m.timestamp || m.createdAt || m.created
      );

      const card = document.createElement("div");
      card.className = "msg";
      card.dataset.type = type;
      card.appendChild(createAvatarEl(avatarUrl, sender, type));

      const content = document.createElement("div");
      content.className = "msg-content";
      content.innerHTML =
        '<div class="msg-header">' +
          '<span>' +
            '<span class="msg-sender">' + escapeHtml(sender) + '</span>' +
            '<span class="msg-badge ' + type + '">' + escapeHtml(type) + '</span>' +
          '</span>' +
          '<span class="msg-time">' + escapeHtml(time) + '</span>' +
        '</div>' +
        '<div class="msg-body' + (messageHtml ? '' : ' msg-body--text') + '">' +
          (messageHtml || escapeHtml(body || "(empty)")) +
        '</div>';

      card.appendChild(content);
      els.messages.appendChild(card);
    });
  }

  async function fetchMessages() {
    if (!token) {
      showError("No token — save one above or edit config.json.");
      return;
    }

    const id = els.convInput.value.trim();
    if (!id) {
      showError("Enter or auto-detect a conversation ID first.");
      return;
    }

    showLoading("Fetching messages…");
    els.refreshBtn.classList.add("spinning");

    try {
      const res = await fetch(
        "https://api.usepylon.com/issues/" + id + "/messages",
        { headers: { Authorization: "Bearer " + token, Accept: "*/*" } }
      );

      if (!res.ok) {
        let detail;
        try { detail = await res.text(); } catch { detail = res.statusText; }
        showError("API " + res.status + ": " + detail);
        return;
      }

      clearStatus();
      renderMessages(await res.json());
    } catch (err) {
      showError(err.message || "Network error");
    } finally {
      els.refreshBtn.classList.remove("spinning");
    }
  }

  els.fetchBtn.addEventListener("click", fetchMessages);
  els.refreshBtn.addEventListener("click", fetchMessages);
  els.convInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); fetchMessages(); }
  });

  els.tokenSave.addEventListener("click", async () => {
    const val = els.tokenInput.value.trim();
    if (!val) { showError("Token cannot be empty."); return; }
    await msg("SET_TOKEN", { token: val });
    token = val;
    tokenSource = "session";
    showTokenBar();
    renderTokenBar(tokenSource);
    clearStatus();
    if (els.convInput.value.trim()) fetchMessages();
  });

  els.tokenInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); els.tokenSave.click(); }
  });

  let rawOpen = false;
  els.rawToggle.addEventListener("click", () => {
    rawOpen = !rawOpen;
    els.rawOutput.classList.toggle("hidden", !rawOpen);
    els.rawToggle.textContent = rawOpen ? "Hide raw JSON" : "Show raw JSON";
  });

  // Init
  const state = await msg("GET_STATE");

  if (state?.token) {
    token = state.token;
    tokenSource = "session";
  } else {
    token = await loadConfigToken();
    if (token) tokenSource = "config";
  }

  if (token) {
    showTokenBar();
    renderTokenBar(tokenSource);
  } else {
    showTokenInput();
  }

  if (state?.conversationId) {
    els.convInput.value = state.conversationId;
    els.convMeta.textContent = "Auto-detected from tab";
    els.convMeta.className = "panel-meta ok";
  }

  if (token && state?.conversationId) fetchMessages();
})();
