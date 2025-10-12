# Git Workflow Guide

This project uses a standard git flow with automated CI/CD via GitHub Actions.

## Branch Structure

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production releases only, tagged | Yes |
| `develop` | Integration branch, builds run here | Yes |
| `feature/*` | Feature development branches | No |

## GitHub Actions Workflows

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| **feature-deploy.yml** | Push to `feature/**` | Deploys to `feature/{name}/` path, comments on PRs |
| **develop-deploy.yml** | Push to `develop` | Deploys to `develop/` path |
| **release.yml** | Push to `main` | Creates tag, GitHub release, deploys to 3 locations |

## Standard Development Workflow

### Adding a Feature

```bash
# 1. Start from develop
git checkout develop
git pull

# 2. Create feature branch
git checkout -b feature/my-feature-name

# 3. Make your changes
# Edit files in dist/, etc.

# 4. Test locally (optional)
npm run deploy  # Deploys to feature/my-feature-name/

# 5. Commit your changes
git add .
git commit -m "Add my feature

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 6. Push feature branch
git push -u origin feature/my-feature-name

# 7. Create PR to develop
gh pr create --base develop --head feature/my-feature-name \
  --title "Add my feature" \
  --body "Description of changes"

# 8. Wait for CI to deploy, then test the feature deployment
# Check the PR comment for the deployment URL

# 9. Merge PR when ready
# This triggers deployment to develop branch

# 10. When ready to release: PR develop -> main
git checkout develop
git pull
gh pr create --base main --head develop \
  --title "Release v0.0.X" \
  --body "Release notes here"

# 11. Merge to main
# This triggers release workflow and deploys to main/, latest/, v{version}/
```

## Version Bumping

**IMPORTANT:** Always bump version in `package.json` BEFORE creating PR to main

```bash
# On develop branch, after all features are merged:
npm version patch  # For bug fixes (0.0.1 → 0.0.2)
npm version minor  # For new features (0.0.1 → 0.1.0)
npm version major  # For breaking changes (0.0.1 → 1.0.0)

# This updates package.json and creates a version commit
git push

# Now create PR to main
gh pr create --base main --head develop \
  --title "Release v0.0.X" \
  --body "..."
```

### Why Version Bumping is Required

Every merge to `main` creates a release with a version tag. The version must be bumped to:
- Track releases properly
- Create unique version tags (e.g., `v0.0.1`, `v0.0.2`)
- Enable pinned version deployments (`/v0.0.1/`)
- Generate accurate changelogs

| Command | Use Case | Version Change |
|---------|----------|----------------|
| `npm version patch` | Bug fixes | 0.0.1 → 0.0.2 |
| `npm version minor` | New features | 0.0.1 → 0.1.0 |
| `npm version major` | Breaking changes | 0.0.1 → 1.0.0 |

## Deployment Paths

Each branch deploys to a unique path on Digital Ocean Spaces:

| Branch | Deployment Path(s) | Cache Strategy |
|--------|-------------------|----------------|
| `feature/xyz` | `feature/xyz/` | no-cache |
| `develop` | `develop/` | no-cache |
| `main` | `main/`, `latest/`, `v{version}/` | `v*` cached forever, others no-cache |

**Example URLs:**
- Feature: `https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/feature/auto-load-css/css-editor-embed.js`
- Develop: `https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/develop/css-editor-embed.js`
- Latest: `https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/latest/css-editor-embed.js`
- Pinned: `https://benelliot-nice.sgp1.digitaloceanspaces.com/media/misc/expert-css/v0.0.1/css-editor-embed.js`

## Quick Reference Commands

```bash
# Deploy locally (uses current branch)
npm run deploy

# Create PR to develop
gh pr create --base develop --head feature/xyz --title "..." --body "..."

# Create PR to main (release)
gh pr create --base main --head develop --title "Release v0.0.X" --body "..."

# Bump version
npm version patch   # Bug fix
npm version minor   # New feature
npm version major   # Breaking change
```

## Important Rules

- ✅ **Always** create features off `develop`, not `main`
- ✅ **Always** bump version before merging to `main`
- ✅ **Always** test feature deployments before merging
- ✅ **Never** force push to `main` or `develop`
- ✅ **Never** merge feature branches directly to `main`
- ❌ **Don't** skip the version bump - releases require it
- ❌ **Don't** commit `.env` file (credentials)

## Branch Protection

Recommended branch protection rules:

### `main` branch:
- ✅ Require pull request before merging
- ✅ Require approvals (at least 1)
- ✅ Require status checks to pass
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

### `develop` branch:
- ✅ Require pull request before merging
- ✅ Require status checks to pass (if any)
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

## Troubleshooting

### "npm version failed - Git working directory not clean"

You have uncommitted changes.

**Fix:**
```bash
git add .
git commit -m "Your changes"
# Now run npm version
npm version patch
```

### Deployment fails

Check the **Actions** tab on GitHub for error details. Common issues:
- Missing GitHub secrets (AWS credentials)
- Invalid Digital Ocean Spaces credentials
- Network issues

**Fix:**
1. Check Repository Settings → Secrets
2. Verify all required secrets are set:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `DO_SPACES_BUCKET`
   - `DO_SPACES_ENDPOINT`

### Feature branch deployment not working

**Check:**
1. Branch name starts with `feature/` (case-sensitive)
2. GitHub Actions workflow is enabled
3. Check Actions tab for workflow run

### Release not created on main merge

**Possible causes:**
1. Version in `package.json` wasn't bumped
2. Tag already exists for that version
3. Workflow failed (check Actions tab)

**Fix:**
```bash
# Bump version and create new commit
git checkout develop
npm version patch
git push

# Create new PR to main with bumped version
```

### Local deployment fails

**Check:**
1. `.env` file exists and has correct credentials
2. You're on a git branch (not detached HEAD)
3. Dependencies are installed (`npm install`)

**Test credentials:**
```bash
# Should show your branch name
git branch --show-current

# Should show configuration
cat .env
```

## Testing Deployments

### Test a Feature Branch

```bash
# 1. Create feature branch
git checkout -b feature/test-deploy

# 2. Make a small change
echo "/* test */" >> dist/css-editor.css

# 3. Commit and push
git add .
git commit -m "Test deploy"
git push -u origin feature/test-deploy

# 4. Check GitHub Actions
# Go to: https://github.com/{user}/{repo}/actions

# 5. Verify deployment
# URL: https://{bucket}.{endpoint}/media/misc/expert-css/feature/test-deploy/css-editor-embed.js
```

### Test Develop Deployment

```bash
# 1. Merge feature to develop via PR
gh pr create --base develop --title "Test"

# 2. Merge the PR (on GitHub or via CLI)
gh pr merge

# 3. Check deployment at develop/
```

### Test Release

```bash
# 1. On develop, bump version
npm version patch

# 2. Create PR to main
gh pr create --base main --title "Release v0.0.2"

# 3. Merge PR

# 4. Verify:
# - Tag created: v0.0.2
# - Release created on GitHub
# - Deployed to: main/, latest/, v0.0.2/
```

## Advanced: Manual Deployment

If GitHub Actions is unavailable, you can deploy manually:

```bash
# 1. Ensure .env file has credentials
cat .env

# 2. Deploy from current branch
npm run deploy

# 3. Manually specify deployment path (not recommended)
GITHUB_REF_NAME=custom-branch npm run deploy
```

## Best Practices

1. **Small, focused PRs** - Easier to review and test
2. **Descriptive commit messages** - Helps generate changelogs
3. **Test before merging** - Use feature branch deployments
4. **Keep develop stable** - Only merge tested features
5. **Release often** - Small, frequent releases over large ones
6. **Document breaking changes** - In PR description and commit messages

## Questions?

- Open an issue: https://github.com/ben-elliot-nice/cxone-expert-enhancements/issues
- Check Actions logs: https://github.com/ben-elliot-nice/cxone-expert-enhancements/actions
