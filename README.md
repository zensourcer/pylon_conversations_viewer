# Pylon Conversation Viewer

Chrome extension that intercepts Pylon conversation links and displays messages in a clean popup window.

## Features

- 🚀 **Auto-opens on click** — Click any Pylon conversation link, popup appears instantly
- 🔒 **Blocks redirect** — Prevents navigation to Pylon web app, closes new tabs automatically
- 🎨 **Clean UI** — Dark theme, type-colored messages (customer/agent/system), avatar support
- 💾 **Flexible token storage** — Save via UI (session) or bundled config file
- 🔄 **Auto-updates** — Switching conversations reloads the popup with new messages
- 📱 **HTML message rendering** — Displays rich formatting, images, links from Pylon API

## Installation

### 1. Clone or download this repository

```bash
git clone <repo-url>
cd pylon-extension
```

### 2. Configure your API token

**Option A: UI input (recommended)**

- Leave `config.json` as-is
- After loading the extension, enter your token in the popup
- Token is saved to session storage (cleared when browser closes)

**Option B: Config file**

- Create a `config.json`:

  ```json
  {
    "bearer_token": "your_actual_pylon_api_token_here"
  }
  ```

- Token persists across browser sessions
- UI input takes priority if both are set

### 3. Load the extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `pylon-extension` folder
5. Extension icon appears in toolbar

### 4. Test it

1. Navigate to `app.usepylon.com`
2. Click any conversation link
3. Popup window opens with messages
4. Original tab closes automatically (if opened in new tab)

## Usage

### Viewing Conversations

**Automatic (recommended):**

- Just click any Pylon conversation link
- Popup opens, conversation ID auto-detected
- Messages load automatically if token is configured

**Manual:**

- Click the extension icon in toolbar
- Paste a conversation ID
- Click "Fetch"

### Managing Tokens

**To save a token via UI:**

1. Open the popup (click extension icon)
2. Enter your Pylon API bearer token
3. Click "Save"
4. Token saved to session (cleared on browser close)

**To change token:**

- Click "Change" in the token status bar
- Enter new token, click "Save"

**To clear token:**

- Close and reopen browser (session token)
- Or edit `config.json` and remove the token

### Refreshing Messages

- Click the refresh icon (↻) in popup header
- Or close and reopen popup
- Messages reload automatically when switching conversations

## How It Works

1. **Content script** runs on `app.usepylon.com/*`
   - Detects clicks on conversation links
   - Blocks default navigation
   - Extracts `conversationID` from URL

2. **Background service worker** manages popup
   - Opens/focuses popup window
   - Closes source tab (if opened in new tab)
   - Persists conversation ID

3. **Popup UI** fetches and renders messages
   - Calls `GET https://api.usepylon.com/issues/{id}/messages`
   - Renders avatars, timestamps, formatted content
   - Displays raw JSON for debugging

## Configuration

### Permissions

Declared in `manifest.json`:

- `storage` — Save token and conversation ID
- `windows` — Create/manage popup window
- `webNavigation` — Detect page navigation
- `host_permissions` — Access Pylon API

## Troubleshooting

### Popup doesn't open on click

1. Reload the extension: `chrome://extensions` → reload button
2. Hard-refresh the Pylon page: Ctrl+Shift+R (Cmd+Shift+R on Mac)
3. Check Service Worker console for errors: `chrome://extensions` → "Service worker" link

### "No token" error

- Enter token via UI, or
- Edit `config.json` with valid bearer token

### API errors (401, 403, etc.)

- Token is invalid or expired
- Get a new token from Pylon settings
- Update via UI or `config.json`

### Images overflow popup width (Chrome)

- Fixed in latest version (popup.css line 266, 221)
- Reload extension and refresh page

### Extension stops working after idle

- MV3 service workers suspend after ~30s
- Extension should auto-resume on next click

## Development

### File Structure

```
pylon-extension/
├── manifest.json       # Extension config
├── background.js       # Service worker (popup management, navigation)
├── content.js          # Injected script (click detection, URL parsing)
├── popup.html          # Popup UI structure
├── popup.css           # Popup styles
├── popup.js            # Popup logic (API calls, rendering)
├── config.json         # Optional token storage
├── README.md           # This file
```

### Debugging

**Content script console:**

- F12 on `app.usepylon.com` page
- Look for `[PYLON CS]` prefix (if debug logging re-added)

**Service worker console:**

- `chrome://extensions` → click "Service worker" link
- Look for `[PYLON BG]` prefix

**Popup console:**

- Right-click popup → Inspect
- Or F12 while popup is open

## Contributing

PRs welcome.
