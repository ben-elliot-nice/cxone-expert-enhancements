# CXone Expert CSS Editor - Standalone Version

A single HTML file that provides a modern CSS editing interface for CXone Expert (MindTouch).

## Quick Start

1. **Open the file**: Simply open `css-editor.html` in your browser (Chrome, Edge, or Firefox recommended)

2. **Configure authentication**:
   - Fill in your Base URL (e.g., `https://help.benelliot-nice.com`)
   - Fill in your authentication tokens (see below for how to get them)

3. **Click "Load CSS from Legacy System"**

4. **Edit CSS** in the Monaco editors

5. **Click "Save All Changes"** to push back to the legacy system

## Getting Your Authentication Tokens

1. Open your CXone Expert site in a browser
2. Log in to the control panel
3. Open Developer Tools (F12)
4. Go to the **Network** tab
5. Navigate to the Custom CSS page (`/deki/cp/custom_css.php`)
6. Find the request to `custom_css.php` in the Network tab
7. Click on it and look at the **Headers** section
8. Find the **Cookie** header and copy these values:
   - `authtoken` (the entire JWT token including quotes)
   - `mtwebsession` (the session ID)
   - `dekisession` (including quotes)

## CORS Notice

**Important**: Due to browser CORS (Cross-Origin Resource Sharing) policies, direct requests from an HTML file to your CXone Expert site may be blocked.

### Solutions:

#### Option 1: Host on the Same Domain (Recommended)
Upload `css-editor.html` to your CXone Expert site (e.g., as a static file) so it runs on the same domain. This completely avoids CORS issues.

#### Option 2: Use a CORS Proxy Extension
Install a browser extension that disables CORS for development:
- **Chrome/Edge**: "CORS Unblock" or "Allow CORS"
- **Firefox**: "CORS Everywhere"

**Note**: Only use these extensions for development and disable them when done.

#### Option 3: Use the Server Version
Use the Node.js server version (see `server.js` and original `README.md`) which acts as a proxy and handles CORS properly.

#### Option 4: Configure Your Server
If you have access to your CXone Expert server configuration, you can add CORS headers to allow your HTML file's origin.

## Features

- **Monaco Editor** - VS Code's editor with CSS syntax highlighting
- **6 Separate Editors** - Edit CSS for all user roles
- **Auto-save Configuration** - Your tokens are saved in localStorage
- **Export Individual Files** - Download any CSS section as a file
- **Single File** - No installation required, just open in browser

## How It Works

1. **Load**: Fetches the HTML from `/deki/cp/custom_css.php`
2. **Parse**: Uses DOMParser to extract textareas and CSRF token
3. **Display**: Initializes Monaco editors with the extracted CSS
4. **Save**: Builds multipart/form-data request and POSTs back

## Security

- Your tokens are stored in **localStorage** in your browser
- Never share your authentication tokens
- Tokens expire periodically and need to be refreshed
- Clear localStorage to remove saved tokens: `localStorage.removeItem('cssEditorConfig')`

## Troubleshooting

### "CORS may block direct requests"
See the CORS Notice section above for solutions.

### "Failed to extract CSRF token"
Your authentication tokens may have expired. Get fresh tokens from the browser's Network tab.

### Editors not loading
Wait a few seconds for Monaco Editor to load from the CDN. Check your internet connection.

### Changes not saving
1. Verify your tokens are correct and current
2. Check browser console (F12) for errors
3. Try the CORS solutions above

## Files

- `css-editor.html` - The complete standalone editor (this is all you need!)
- `server.js` - Alternative Node.js server version (if you prefer)
- `README.md` - Documentation for the server version

## CDN Dependencies

This file uses these CDN resources:
- Monaco Editor: https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/

If you need to work offline, download Monaco Editor and update the paths in the HTML file.

## Future Enhancements

- [ ] Dynamic token refresh
- [ ] CSS validation
- [ ] Diff view
- [ ] Undo/redo history
- [ ] Import CSS from file
