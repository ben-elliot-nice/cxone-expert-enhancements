@echo off
set USER_DATA_DIR=%USERPROFILE%\.chrome-claude-devcontainer

"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --remote-debugging-port=9222 ^
  --disable-extensions ^
  --ignore-certificate-errors ^
  --ignore-certificate-errors-spki-list ^
  --allow-insecure-localhost ^
  --disable-web-security ^
  --disable-features=IsolateOrigins,site-per-process ^
  --user-data-dir="%USER_DATA_DIR%" ^
  --no-first-run ^
  --no-default-browser-check