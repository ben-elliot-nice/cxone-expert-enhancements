# Development Guide

This guide covers local development setup and workflow for contributing to CXone Expert Enhancements.

## Prerequisites

- **Node.js 18+** - Required for dependencies and scripts
- **Git** - Version control
- **Digital Ocean Spaces credentials** - For deployment testing (optional for development)

## Local Setup

### 1. Clone the Repository

```bash
git clone git@github.com:ben-elliot-nice/cxone-expert-enhancements.git
cd cxone-expert-enhancements
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment (Optional)

For deployment testing, create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your Digital Ocean Spaces credentials:

```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
DO_SPACES_BUCKET=benelliot-nice
DO_SPACES_ENDPOINT=syd1.digitaloceanspaces.com
```

**Note:** Environment setup is only needed if you want to test deployments locally. It's not required for code development.

## Development Workflow

### Making Changes

All source files are in the `/dist/` directory:

- `dist/expert-enhancements-embed.js` - Loader script
- `dist/expert-enhancements-core.js` - Core app manager
- `dist/expert-enhancements-core.css` - Core styling
- `dist/expert-enhancements-css.js` - CSS Editor module
- `dist/expert-enhancements-css.css` - CSS Editor styling
- `dist/expert-enhancements-html.js` - HTML Editor module

**Important:** There is currently no build step. Edit files in `/dist/` directly.

### Testing Your Changes

#### Option 1: Local File Testing

1. Make your changes to files in `/dist/`
2. Update your CXone Expert site to load from your local files
3. Test in browser

#### Option 2: Deploy to Test Branch

```bash
# Make sure you're on a feature branch
git checkout -b feature/my-feature

# Deploy to your branch-specific path
npm run deploy
```

This deploys to: `https://releases.benelliot-nice.com/cxone-expert-enhancements/feature-my-feature/`

Then update your embed tag to test:
```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/feature-my-feature/expert-enhancements-embed.js"></script>
```

### Git Workflow

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) for detailed branching, versioning, and release workflow.

**Quick reference:**

1. Create feature branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/my-feature
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: Add my feature

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

3. Push and create PR:
   ```bash
   git push -u origin feature/my-feature
   gh pr create --base develop --title "Add my feature" --body "Description"
   ```

## Troubleshooting

### Local Deploy Issues

**"npm run deploy" fails:**
- Ensure `.env` file exists with valid credentials
- Run `npm install` to install dependencies
- Check that you're on a git branch (not detached HEAD)

**Permission denied:**
- Verify Digital Ocean Spaces credentials
- Check that bucket name and endpoint are correct

### Development Tips

**Monaco Editor not loading:**
- Monaco is loaded from CDN (`https://cdn.jsdelivr.net/npm/monaco-editor`)
- Check browser console for network errors
- Ensure internet connection is available

**Changes not appearing:**
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Check browser cache
- Verify correct embed URL is being loaded

**localStorage issues:**
- localStorage quota: ~5-10MB per domain
- Clear localStorage in browser DevTools if testing storage limits
- Check browser's private/incognito mode settings

## Code Style

- Use ES6+ JavaScript features
- 4-space indentation
- Descriptive variable and function names
- Add comments for complex logic
- Follow existing code patterns

## Adding New Features

### Creating a New App Module

New apps follow this structure:

```javascript
const MyApp = {
    name: 'My App',
    id: 'my-app',

    async init(context) {
        // Initialize app (load dependencies, etc.)
    },

    async mount(container) {
        // Build UI and mount to container
    },

    async unmount() {
        // Cleanup when app is unmounted
    }
};

// Register the app
AppManager.registerApp(MyApp.id, MyApp);
```

See `dist/expert-enhancements-css.js` for a complete example.

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/ben-elliot-nice/cxone-expert-enhancements/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues)
- **Pull Requests:** See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) for PR guidelines
