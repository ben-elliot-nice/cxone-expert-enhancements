# CXone Expert Enhancements

Extensible toolkit loader for CXone Expert with modular enhancement modules including CSS editor, live preview, and more.

## 🚀 Quick Start

### Installation

Add this script to the `<head>` of your CXone Expert site:

#### Option 1: Latest Version (Recommended - Auto-Updates)

```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor-embed.js"></script>
```

This URL always points to the latest released version. You'll automatically receive updates when new versions are deployed.

#### Option 2: Pinned Version (No Auto-Updates)

```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/releases/v0.2.0/css-editor-embed.js"></script>
```

Pin to a specific version to prevent automatic updates. Replace `vX.X.X` with your desired version (e.g., `v0.0.7`).

### What You Get

Once loaded, a floating toggle button appears in the top-right corner. Click it to access:

- **CSS Editor** - Live CSS editing with syntax highlighting (Monaco Editor)
- **Role-Based Editing** - Edit CSS for different user roles independently
- **Live Preview** - See changes in real-time before saving
- **Auto-Complete** - Context-aware CSS suggestions based on page elements
- **Persistent Storage** - Your changes are saved automatically

## ✨ Features

- **🎈 Floating Overlay Mode** - Draggable, resizable CSS editor overlay
- **🔴 Live CSS Preview** - See your CSS changes reflected instantly (no save required!)
- **Monaco Editor Integration** - Same editor as VS Code with full syntax highlighting
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
- **Context-Aware Autocomplete** - Suggests classes, IDs, and selectors from the current page

## 🏗️ Development

### Prerequisites

- Node.js 18+
- Digital Ocean Spaces credentials (for deployment)
- Git

### Local Setup

1. Clone the repository:
```bash
git clone git@github.com:ben-elliot-nice/cxone-expert-enhancements.git
cd cxone-expert-enhancements
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (see [.env.example](.env.example)):
```bash
cp .env.example .env
# Edit .env with your Digital Ocean Spaces credentials
```

4. Make changes to files in `/dist/`

5. Deploy to test:
```bash
npm run deploy
```

This will deploy to a path based on your current git branch.

### Git Workflow

This project uses a structured git flow with automated deployments:

- **`main`** → Deploy to `main/`, `latest/`, and `releases/v{version}/` + create GitHub release
- **`develop`** → Deploy to `develop/` for integration testing
- **Any other branch** → Deploy to `{sanitized-branch-name}/` for testing (supports feature/, hotfix/, bugfix/, refactor/, etc.)

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) for detailed workflow instructions.

#### Branch Naming Best Practices

While the deployment system supports any branch name, we recommend following these conventions:

- ✅ **Good:** `feature/user-auth`, `hotfix/bug-123`, `bugfix/issue-456`, `refactor/cleanup-css`
- ⚠️ **Works but ugly:** `mybranch`, `test123`, `quick-fix`
- ❌ **Avoid:** Special characters are stripped (e.g., `test@#$%` becomes `test-----`)

**Rules:**
- Branch names are sanitized: only `a-z`, `0-9`, `-`, `_`, `/` are kept
- Other characters are replaced with `-`
- Use descriptive, lowercase names with slashes for categorization
- Main and develop are protected and won't be deployed as feature branches

### Branch-Specific Deployments

Each branch automatically deploys to its own path on Digital Ocean Spaces:

| Branch | Deployment Path | Use Case |
|--------|----------------|----------|
| `main` | `main/`, `latest/`, `releases/v{version}/` | Production releases |
| `develop` | `develop/` | Integration testing |
| `feature/my-feature` | `feature-my-feature/` | Feature development & testing |
| `hotfix/bug-123` | `hotfix-bug-123/` | Hotfix testing |
| `bugfix/issue-456` | `bugfix-issue-456/` | Bug fix testing |
| Any other branch | `{sanitized-name}/` | Branch testing |

**Example URLs:**
```
https://releases.benelliot-nice.com/cxone-expert-enhancements/
├── main/css-editor-embed.js                    (main branch)
├── latest/css-editor-embed.js                  (latest release - auto-updates)
├── releases/
│   ├── v0.0.5/css-editor-embed.js              (pinned version - immutable)
│   └── vX.X.X/css-editor-embed.js              (other versions)
├── develop/css-editor-embed.js                 (develop branch)
├── feature-auto-load-css/css-editor-embed.js   (feature branch)
├── hotfix-bug-123/css-editor-embed.js          (hotfix branch)
└── bugfix-issue-456/css-editor-embed.js        (bugfix branch)
```

## 📦 Releases

### Creating a Release

1. Ensure all changes are merged to `develop`
2. Bump version in `package.json`:
```bash
npm version patch  # For bug fixes (0.0.1 → 0.0.2)
npm version minor  # For new features (0.0.1 → 0.1.0)
npm version major  # For breaking changes (0.0.1 → 1.0.0)
```

3. Create PR from `develop` → `main`
4. Merge PR - this triggers automatic:
   - Git tag creation (`v0.0.X`)
   - GitHub release with changelog
   - Deployment to 3 locations (`main/`, `latest/`, `releases/v{version}/`)

### Version Pinning Strategy

Users can choose how they receive updates:

**Auto-update (latest) - Recommended:**
```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor-embed.js"></script>
```
- Always gets the newest release automatically
- Cached with `no-cache` headers for quick updates
- Good for: Most users who want bug fixes and features

**Pinned version - For stability:**
```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/releases/v0.2.0/css-editor-embed.js"></script>
```
- Stays on that specific version forever
- Cached permanently (immutable)
- Good for: Production sites requiring stability
- Replace `vX.X.X` with your desired version (e.g., `v0.0.7`)

**Develop - Bleeding edge:**
```html
<script src="https://releases.benelliot-nice.com/cxone-expert-enhancements/develop/css-editor-embed.js"></script>
```
- Latest development code
- May be unstable
- Good for: Testing upcoming features

## 🔧 GitHub Actions Setup

### Required Secrets

Configure these secrets in your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `AWS_ACCESS_KEY_ID` | Digital Ocean Spaces Access Key | DO Spaces → API |
| `AWS_SECRET_ACCESS_KEY` | Digital Ocean Spaces Secret Key | DO Spaces → API |
| `DO_SPACES_BUCKET` | Target bucket name | `benelliot-nice` |
| `DO_SPACES_ENDPOINT` | Region endpoint | `syd1.digitaloceanspaces.com` |

### Workflows

Three automated workflows handle deployments:

1. **`feature-deploy.yml`** - Deploys feature branches to `feature/{name}/`
   - Triggers: Push to `feature/**` branches
   - Creates PR comments with deployment URLs

2. **`develop-deploy.yml`** - Deploys develop branch to `develop/`
   - Triggers: Push to `develop` branch
   - Creates deployment summary

3. **`release.yml`** - Deploys main to multiple locations + creates release
   - Triggers: Push to `main` branch
   - Creates git tag (e.g., `v0.0.1`)
   - Generates GitHub release with changelog
   - Deploys to `main/`, `latest/`, `releases/v{version}/`

## 📁 Project Structure

```
cxone-expert-enhancements/
├── dist/
│   ├── css-editor.css         # Styles for the editor
│   ├── css-editor.js          # Main editor logic
│   └── css-editor-embed.js    # Embed loader script
├── .github/
│   └── workflows/
│       ├── feature-deploy.yml # Feature branch CI/CD
│       ├── develop-deploy.yml # Develop branch CI/CD
│       └── release.yml        # Release & main CI/CD
├── deploy.js                  # Environment-aware deployment script
├── package.json               # Project metadata & version
├── .env.example               # Environment template
├── .env                       # Local credentials (gitignored)
├── GIT_WORKFLOW.md            # Detailed workflow guide
└── README.md                  # This file
```

## 🎯 Roadmap

This project is designed to be extensible. Future modules planned:

- **JavaScript Editor** - Live JS editing similar to CSS editor
- **DOM Inspector** - Element picker and live inspection
- **Analytics Dashboard** - Real-time usage metrics
- **Permissions Manager** - Visual permission configuration
- **Accessibility Checker** - WCAG compliance scanning
- **Theme Previewer** - Live theme switching
- **Module Loader** - Dynamic module loading system

## 🐛 Troubleshooting

### Authentication Errors
- Check that your tokens are current and properly copied
- Ensure quotes are included where needed
- Try logging in again and getting fresh tokens

### Deployment Fails
- Verify GitHub secrets are configured correctly
- Check Digital Ocean Spaces credentials
- Ensure bucket and endpoint are correct

### CSS Not Loading
- Check browser console for errors
- Verify the embed script URL is correct
- Ensure you have admin permissions

### Local Deploy Issues
- Make sure `.env` file exists with correct credentials
- Run `npm install` to ensure dependencies are installed
- Check that you're on a git branch (deploy.js needs branch name)

## 📄 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch from `develop`:
```bash
git checkout develop
git pull
git checkout -b feature/amazing-feature
```
3. Make your changes
4. Commit following conventional commits
5. Push your branch
6. Open a Pull Request to `develop`

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) for detailed contribution guidelines.

## 🙏 Acknowledgments

- Built with [Monaco Editor](https://microsoft.github.io/monaco-editor/) - The code editor that powers VS Code
- Deployed to [Digital Ocean Spaces](https://www.digitalocean.com/products/spaces)
- Automated with [GitHub Actions](https://github.com/features/actions)

## 📞 Support

- **Issues**: https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues
- **Discussions**: https://github.com/ben-elliot-nice/cxone-expert-enhancements/discussions

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
