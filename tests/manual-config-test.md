# Configuration System Manual Testing

## Prerequisites
- Local development environment running
- Access to CXone Expert site
- Both admin and anonymous user access

## Test 1: Default Configuration

**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Reload page
3. Open console: `window.ExpertEnhancements.Config.export()`

**Expected:**
- All settings have default values from schema
- effectiveConfig matches defaults
- No embed/site/user properties

## Test 2: localStorage Persistence

**Steps:**
1. Set a preference: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 18)`
2. Verify: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`
3. Reload page
4. Check again: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`

**Expected:**
- Setting persists across reload
- Value is 18, not default (14)

## Test 3: Embed Config (Locked)

**Steps:**
1. Add to script tag: `data-config='{"editor":{"theme":"vs-light"}}'`
2. Reload page
3. Try to change: `window.ExpertEnhancements.Config.instance.set('editor.theme', 'vs-dark')`
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`
5. Check source: `window.ExpertEnhancements.Config.instance.getEffectiveValue('editor.theme')`

**Expected:**
- Theme is vs-light (from embed config)
- Setting attempt saves to localStorage but embed config wins
- Source shows 'embed' and locked: true

## Test 4: Monaco Editor Integration

**Steps:**
1. Set font size: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 20)`
2. Open CSS Editor
3. Inspect Monaco editor

**Expected:**
- Editor uses fontSize 20
- Setting applied to Monaco initialization

## Test 5: Cross-Device Sync (Logged-In User)

**Steps:**
1. Login to Expert as non-anonymous user
2. Set preference: `window.ExpertEnhancements.Config.instance.set('editor.theme', 'vs-light')`
3. Check network tab for PUT request to Properties API
4. Logout and log back in (or use different browser)
5. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- PUT request to `/@api/deki/users/{user}/properties/urn:expertEnhancements.user.editor.theme`
- Setting persists across login sessions
- Value synced from server

## Test 6: Site Properties (Admin)

**Steps:**
1. Login as admin
2. Set site property via API or console
3. Logout (become anonymous)
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- Anonymous users can read site properties
- Site default applies when user hasn't set preference

## Test 7: Reset to Default

**Steps:**
1. Set custom value: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 22)`
2. Verify changed: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`
3. Reset: `await window.ExpertEnhancements.Config.instance.reset('editor.fontSize')`
4. Check value: `window.ExpertEnhancements.Config.instance.get('editor.fontSize')`

**Expected:**
- Value returns to default (14)
- localStorage entry removed
- Server property deleted (if was synced)

## Test 8: Security - Secrets Don't Sync

**Steps:**
1. Set API key: `window.ExpertEnhancements.Config.instance.set('apiKeys.s3AccessKey', 'secret123')`
2. Check localStorage: `localStorage.getItem('expertEnhancements:config:apiKeys.s3AccessKey')`
3. Check network tab for any PUT requests

**Expected:**
- Value saved to localStorage
- NO network request to Properties API
- serverSafe: false prevents sync

## Test 9: Offline Fallback

**Steps:**
1. While logged in, set preference
2. Open DevTools Network tab, set to "Offline"
3. Reload page
4. Check config: `window.ExpertEnhancements.Config.instance.get('editor.theme')`

**Expected:**
- Config loads from localStorage cache
- No errors in console
- Settings available offline

## Test 10: Validation

**Steps:**
1. Try invalid value: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 999)`
2. Try invalid type: `window.ExpertEnhancements.Config.instance.set('editor.fontSize', 'large')`

**Expected:**
- Validation error thrown
- Value not saved
- Config unchanged
