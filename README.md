# CXone Expert Enhancements

Extensible developer toolkit for CXone Expert with CSS/HTML editors, live preview, and more.

## 🚀 Quick Start

Add this single line to the `<head>` of your CXone Expert site:

### Latest Version (Recommended)

```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/embed.js"></script>
```

✅ Auto-updates to newest releases
✅ Always get bug fixes and features
✅ Recommended for most users

### Pinned Version (Stable)

```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/releases/v1.3.0/embed.js"></script>
```

✅ Stays on specific version forever
✅ Perfect for production stability
✅ Replace `v1.3.0` with your desired version

### That's it!

Once loaded, a floating toggle button appears in the top-right corner. Click it to access the editor tools.

## ✨ Features

### 🎨 CSS Editor
- **Live Preview** - See changes in real-time without saving
- **Monaco Editor** - Same powerful editor as VS Code
- **Role-Based Editing** - Separate CSS for different user roles
  - All Roles
  - Anonymous
  - Community Member
  - Pro Member
  - Admin
  - Legacy Browser
- **Auto-Complete** - Context-aware CSS suggestions from your page
- **Syntax Highlighting** - Full CSS language support
- **Dirty State Tracking** - Visual indicators show unsaved changes (✓/●)

### 🛠️ Editor Features
- **Draggable & Resizable** - Position and size to fit your workflow
- **Fullscreen Mode** - Double-click header to maximize
- **Mobile Responsive** - Automatically adapts to smaller screens
- **Persistent Storage** - Your changes survive page reloads
- **Direct Save** - Saves directly to CXone Expert control panel
- **Export** - Download individual or all CSS files
- **Multiple Editors** - Toggle between CSS and HTML editors
- **Split View** - Show up to 3 editors simultaneously

### 🔒 Security & Reliability
- **CSRF Protection** - Automatic security token handling
- **localStorage Backup** - Never lose your work
- **Error Recovery** - Graceful handling of save failures

## 📸 Screenshots

*Coming soon - screenshots of the editor in action*

## 💡 Usage Examples

### Editing CSS for All Users

1. Click the floating toggle button
2. Select "CSS Editor" from the dropdown
3. Click "All Roles" tab
4. Start typing your CSS
5. See live preview instantly
6. Click "Save All" when ready

### Editing CSS for Specific Roles

1. Open CSS Editor
2. Click the role tab you want to edit (e.g., "Anonymous")
3. Make your changes
4. Each role's CSS is saved independently

### Exporting Your CSS

1. Open CSS Editor
2. Click dropdown arrow next to "Save All"
3. Select "Export All" or individual role exports

## 🎯 Roadmap

Upcoming features and modules:

- **IntelliSense/Autocomplete** (#42) - Enhanced CSS property suggestions
- **Code Formatting** (#44) - Auto-format CSS/HTML on save
- **Drag & Drop Import** (#45) - Import CSS files by dragging
- **Browser Extension** (#54) - Replace bookmarklet with proper extension
- **New Apps:**
  - Demo Builder (#57) - Build demos with CSS extraction
  - Image Optimizer (#56) - Optimize images for performance
  - Styling Best Practices Checker (#58) - Lint your CSS

See [open issues](https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues) for full roadmap.

## 🐛 Troubleshooting

### Editor Not Appearing

**Problem:** No floating toggle button visible
**Solutions:**
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check browser console for errors (F12)
- Verify embed script URL is correct
- Ensure you have admin permissions on CXone Expert

### CSS Not Saving

**Problem:** Save button does nothing or shows error
**Solutions:**
- Check that you're logged in to CXone Expert
- Verify you have permission to edit CSS
- Try refreshing and loading the editor again
- Check browser console for error messages

### Changes Disappear After Page Reload

**Problem:** CSS reverts to previous version
**Solutions:**
- Click "Save All" before closing (not just preview)
- Check that save completed successfully (green checkmark)
- Verify localStorage is enabled in your browser

### Editor is Slow or Laggy

**Problem:** Performance issues when typing
**Solutions:**
- Close other browser tabs to free memory
- Disable live preview toggle if too slow
- Try refreshing the page
- Clear browser cache

### localStorage Quota Exceeded

**Problem:** "Storage quota exceeded" error
**Solutions:**
- Export your CSS before clearing
- Clear old localStorage data in DevTools
- Typical quota: 5-10MB per domain

### Can't See Live Preview

**Problem:** Changes don't appear until saved
**Solutions:**
- Ensure live preview toggle is ON (check for indicator)
- Try typing in the editor to trigger preview
- Refresh page and re-open editor

## ❓ FAQ

**Q: Is this safe to use in production?**
A: Yes! The latest version is stable and tested. For maximum safety, use a pinned version.

**Q: Will this slow down my site?**
A: No. The embed script is tiny (~10KB) and loads asynchronously. Editors only load when you click the toggle button.

**Q: Can I use this on multiple CXone Expert sites?**
A: Yes! Just add the embed script to each site's `<head>`.

**Q: What happens if I have unsaved changes and close the editor?**
A: Your changes are preserved in localStorage. Re-open the editor to continue editing.

**Q: Can multiple people edit CSS at the same time?**
A: The editor doesn't have real-time collaboration. Last save wins. Coordinate with your team to avoid conflicts.

**Q: How do I uninstall?**
A: Simply remove the `<script>` tag from your site's `<head>`. No other cleanup needed.

**Q: Does this work offline?**
A: No. The editor requires internet connection to load Monaco Editor from CDN.

**Q: Which browsers are supported?**
A: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+. Modern browsers only.

**Q: Can I customize the colors or position?**
A: Not yet, but configurable options are planned (#48). For now, you can drag/resize the overlay.

**Q: Where is my CSS actually saved?**
A: Two places: (1) CXone Expert's database when you click "Save All", (2) Your browser's localStorage as a backup.

## 🤝 Contributing

We welcome contributions! To get started:

1. Read the [Development Guide](docs/DEVELOPMENT.md)
2. Check [open issues](https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues)
3. Fork the repository
4. Create a feature branch
5. Submit a pull request

**Developer Resources:**
- [Development Setup](docs/DEVELOPMENT.md) - Local setup and workflow
- [Git Workflow](docs/GIT_WORKFLOW.md) - Branching and release process
- [Deployment Guide](docs/DEPLOYMENT.md) - CI/CD and deployments
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture

## 📄 License

ISC

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ben-elliot-nice/cxone-expert-enhancements/discussions)
- **Documentation:** [docs/](docs/)

## 🙏 Acknowledgments

- Built with [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code
- Hosted on [Digital Ocean Spaces](https://www.digitalocean.com/products/spaces)
- Automated with [GitHub Actions](https://github.com/features/actions)

## 🔖 Version

Current version: **1.2.0**

See [releases](https://github.com/ben-elliot-nice/cxone-expert-enhancements/releases) for changelog and version history.

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
