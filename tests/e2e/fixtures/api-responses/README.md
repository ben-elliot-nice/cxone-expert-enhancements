# CXone Expert API Fixtures

This directory contains real API request/response payloads captured from CXone Expert.

## Capturing Payloads

1. Open CXone Expert site in Chrome DevTools
2. Navigate to Network tab
3. Filter for XHR/Fetch requests
4. Perform action (save CSS, load HTML, etc.)
5. Right-click request → Copy → Copy as JSON
6. Save to appropriate file in this directory

## Endpoint Inventory

### CSS Endpoints

- `POST /api/css/save` - Save CSS for specific role
  - Request: `css/save-request.json`
  - Success Response: `css/save-success.json`
  - Error Response: `css/save-error.json`

- `GET /api/css/load` - Load CSS for all roles
  - Response: `css/load-all-roles.json`

### HTML Endpoints

- `POST /api/html/save` - Save HTML body/footer
  - Request: `html/save-request.json`
  - Success Response: `html/save-success.json`

- `GET /api/html/load` - Load HTML body/footer
  - Response: `html/load-body-footer.json`

### CSRF Token

- `GET /api/csrf-token` - Get CSRF token
  - Response: `csrf/token-response.json`

## Updating Fixtures

When CXone Expert API changes:
1. Re-capture payloads following steps above
2. Update fixture files
3. Run E2E tests to verify compatibility
4. Document API version in this README

**Current API Version:** (To be filled in during capture)
**Last Updated:** (To be filled in during capture)
