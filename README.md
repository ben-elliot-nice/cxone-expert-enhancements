# CXone Expert CSS Editor

A modern, user-friendly CSS editor interface for the CXone Expert (formerly MindTouch) legacy control panel. This tool provides a better editing experience with syntax highlighting, code completion, and a cleaner interface.

## Features

- **Monaco Editor Integration** - Same editor as VS Code with full CSS syntax highlighting
- **Multiple Role Support** - Edit CSS for all user roles (All Roles, Anonymous, Community Member, Pro Member, Admin, Legacy Browser)
- **Export Functionality** - Export individual CSS files for each role
- **Auto-sync** - Automatically fetches current CSS from legacy system on load
- **Direct Save** - Saves changes directly back to the legacy control panel
- **CSRF Protection** - Automatically handles CSRF tokens

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to CXone Expert control panel with valid authentication

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Configuration

Update the credentials in `server.js` (lines 9-15):

```javascript
const CONFIG = {
    baseUrl: 'https://help.benelliot-nice.com',
    cssEditorPath: '/deki/cp/custom_css.php?params=%2F',
    cookies: {
        authtoken: 'YOUR_AUTH_TOKEN_HERE',
        mtwebsession: 'YOUR_SESSION_TOKEN_HERE',
        dekisession: 'YOUR_DEKI_SESSION_HERE'
    }
};
```

### Getting Your Authentication Tokens

1. Open your CXone Expert site in a browser
2. Log in to the control panel
3. Open Developer Tools (F12)
4. Go to the Network tab
5. Navigate to the Custom CSS page
6. Look for the request to `custom_css.php`
7. Copy the cookie values from the request headers:
   - `authtoken` (including the quotes)
   - `mtwebsession`
   - `dekisession` (including the quotes)

**Note:** These tokens will expire. You'll need to update them periodically. A future enhancement will add dynamic authentication.

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser to:
```
http://localhost:3000
```

3. The page will automatically load the current CSS from your CXone Expert site

4. Edit the CSS in any of the editors

5. Click "Save All Changes" to push updates back to the legacy system

6. Use individual "Export CSS" buttons to download specific role CSS files

## Project Structure

```
expert-css-editor/
├── index.html          # Frontend interface with Monaco editors
├── server.js           # Express backend proxy server
├── package.json        # Node.js dependencies
└── README.md          # This file
```

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

- [ ] Dynamic authentication (OAuth or session management)
- [ ] Diff view to see changes before saving
- [ ] CSS validation and linting
- [ ] Version history
- [ ] Undo/redo functionality
- [ ] Dark/light theme toggle
- [ ] CSS minification option
- [ ] Live preview (if possible)

## Security Notes

- **Never commit your authentication tokens to version control**
- Add `server.js` to `.gitignore` after configuring, or use environment variables
- Consider using a `.env` file for sensitive configuration
- Tokens should be treated as passwords

## License

ISC

## Support

For issues or questions, please open an issue on the repository.
