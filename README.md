# CXone Expert CSS Editor

A modern CSS editor interface for the CXone Expert (MindTouch) legacy control panel with toggle-based split-view editing. Now available as a **floating overlay** that can be embedded anywhere on your CX1 site!

## Features

- **🎈 Floating Overlay Mode** - Embeddable JavaScript that creates a draggable, resizable CSS editor overlay
- **🔴 Live CSS Preview** - See your CSS changes reflected instantly in the page (no save required!)
- **Monaco Editor Integration** - Same editor as VS Code with full CSS syntax highlighting
- **Toggle-Based Split View** - Show/hide up to 3 editors simultaneously
- **Multiple Role Support** - Edit CSS for all user roles (All Roles, Anonymous, Community Member, Pro Member, Admin, Legacy Browser)
- **Draggable & Resizable** - Move and resize the editor window to fit your workflow
- **Mobile Responsive** - Automatically adapts to smaller screens
- **State Management** - CSS content persists even when editors are toggled off
- **localStorage Persistence** - Your changes survive page reloads
- **Export Functionality** - Export individual or active CSS files
- **Direct Save** - Saves changes directly back to the legacy control panel
- **CSRF Protection** - Automatically handles CSRF tokens
- **Dirty State Tracking** - Visual indicators (✓/●) show saved vs unsaved changes

## Project Structure

```
expert-css-editor/
├── css-editor.html          # Original single-file version (for reference)
├── dist/                    # Deployable files
│   ├── css-editor.css      # Styles
│   ├── css-editor.js       # Application logic
│   ├── css-editor-embed.js # 🆕 Embeddable loader (floating overlay)
│   ├── index.html          # Full HTML page
│   ├── cxone-embed.html    # Minimal HTML for pasting into CXone Expert
│   └── embed-demo.html     # 🆕 Demo page showing the floating overlay
├── deploy.js               # Deployment script for Digital Ocean Spaces
├── .env                    # Environment variables (DO credentials)
├── package.json            # Dependencies and scripts
└── README.md              # This file
```

## 🚀 Quick Start - Floating Overlay (Recommended!)

### Option 1: Single-Line Embed (Easiest!)

Add this **one line** to the `<head>` of your CX1 site:

```html
<script src="https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/css-editor-embed.js"></script>
```

That's it! A floating CSS editor toggle button (`</>`) will appear in the top-right corner.

**Try the demo**: Open `dist/embed-demo.html` in your browser to see it in action!

### What you get:
- 🔘 Floating toggle button in top-right corner
- 📦 Draggable editor overlay
- 📏 Resizable window (drag bottom-right corner)
- 🔴 **Live CSS preview** - changes appear instantly!
- 💾 Auto-saves to localStorage
- 📱 Mobile responsive

### Usage:
1. Click the `</>` button to open the editor
2. Click a role button (e.g., "All Roles") to activate an editor
3. Edit CSS and watch changes apply live to the page
4. Drag the purple header to move the window
5. Drag the bottom-right corner to resize
6. Click "Save All" when ready to persist changes to the server

---

## 🛠️ Development & Deployment

### 1. Installation

```bash
npm install
```

### 2. Configuration

Create a `.env` file with your Digital Ocean Spaces credentials:

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DO_SPACES_BUCKET=benelliot-nice
DO_SPACES_ENDPOINT=sgp1.digitaloceanspaces.com
```

### 3. Deploy to Digital Ocean Spaces

```bash
npm run deploy
```

This uploads `css-editor.css` and `css-editor.js` to your DO Spaces bucket.

**Public URLs**:
- Embed (floating overlay): https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/css-editor-embed.js
- CSS: https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/css-editor.css
- JS: https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/css-editor.js

### 4. Use in CXone Expert

**Option A (Recommended):** Add the embed script to your site's `<head>` tag for a floating overlay editor.

**Option B (Traditional):** Copy/paste the contents of `dist/cxone-embed.html` into the CXone Expert custom HTML field for an inline editor.

## Development Workflow

### Making Changes

Edit the separated files in the `dist/` directory:
- **CSS**: `dist/css-editor.css`
- **JavaScript**: `dist/css-editor.js`
- **HTML** (for embedding): `dist/cxone-embed.html`

### Deploying Updates

```bash
npm run deploy
```

Once deployed, the changes are live immediately. No need to update the CXone Expert page - it automatically loads the latest from DO Spaces.

## Usage

1. Paste `dist/cxone-embed.html` into CXone Expert custom HTML field (one-time setup)
2. Navigate to the page in CXone Expert
3. Enter your authentication tokens (Base URL, Auth Token, MT Session, Deki Session)
4. Click "Load CSS from Legacy System"
5. Toggle editors on/off (max 3 active simultaneously)
6. Edit CSS with Monaco Editor
7. Click "Save All Changes" to push updates back
8. Use "Export Active" or individual export buttons to download CSS files

## How It Works

### Loading CSS

1. Frontend makes request to `/api/css`
2. Server fetches HTML from legacy control panel
3. Server parses HTML using Cheerio to extract:
   - CSRF token from hidden input
   - CSS content from each textarea
4. Server returns JSON with all CSS and CSRF token
5. Frontend initializes Monaco editors with the CSS

### Saving CSS

1. User clicks "Save All Changes"
2. Frontend sends JSON with all CSS content + CSRF token to `/api/css` (POST)
3. Server constructs multipart/form-data request (same format as legacy page)
4. Server posts to legacy control panel
5. Legacy system responds with 302 redirect (success)
6. Frontend shows success message

## API Endpoints

### GET /api/css

Fetches current CSS from legacy system.

**Response:**
```json
{
  "success": true,
  "csrf_token": "...",
  "css": {
    "all": "/* CSS content */",
    "anonymous": "/* CSS content */",
    "viewer": "/* CSS content */",
    "seated": "/* CSS content */",
    "admin": "/* CSS content */",
    "grape": "/* CSS content */"
  }
}
```

### POST /api/css

Saves CSS to legacy system.

**Request Body:**
```json
{
  "csrf_token": "...",
  "css_template_all": "/* CSS */",
  "css_template_anonymous": "/* CSS */",
  "css_template_viewer": "/* CSS */",
  "css_template_seated": "/* CSS */",
  "css_template_admin": "/* CSS */",
  "css_template_grape": "/* CSS */"
}
```

**Response:**
```json
{
  "success": true,
  "message": "CSS saved successfully"
}
```

## Troubleshooting

### Authentication Errors

- Check that your tokens are current and properly copied
- Ensure quotes are included where needed (authtoken and dekisession)
- Try logging in again and getting fresh tokens

### CORS Issues

- This tool uses a backend proxy to avoid CORS issues
- All requests to the legacy system go through the Express server

### Save Not Working

- Check browser console for errors
- Verify CSRF token is being extracted correctly
- Check that multipart boundary is being generated properly

## Future Enhancements

- [x] ~~Live preview~~ ✅ **DONE!** (See floating overlay mode)
- [x] ~~Draggable/resizable editor~~ ✅ **DONE!**
- [ ] Dynamic authentication (OAuth or session management)
- [ ] Diff view to see changes before saving
- [ ] Enhanced CSS validation and linting
- [ ] Version history
- [ ] Undo/redo functionality
- [ ] Dark/light theme toggle
- [ ] CSS minification option
- [ ] Fullscreen mode
- [ ] Keyboard shortcuts (Ctrl+S to save, etc.)

## Security Notes

- **Never commit your authentication tokens to version control**
- Add `server.js` to `.gitignore` after configuring, or use environment variables
- Consider using a `.env` file for sensitive configuration
- Tokens should be treated as passwords

## License

ISC

## Support

For issues or questions, please open an issue on the repository.
