# Git Workflow Guide

This project uses a standard git flow with automated CI/CD via GitHub Actions.

## Branch Structure

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production releases only, tagged | Yes |
| `develop` | Integration branch, builds run here | Yes |
| `feature/*` | Feature development branches | No |
| `hotfix/*` | Hotfix branches | No |
| `bugfix/*` | Bug fix branches | No |
| Any other | Ad-hoc testing branches | No |

**Note:** Any branch except `main` and `develop` will be automatically deployed for testing.

## GitHub Actions Workflows

| Workflow | Trigger | What It Does |
|----------|---------|--------------|
| **feature-deploy.yml** | Push to any branch except `main`/`develop` | Deploys to `{sanitized-branch-name}/` path, comments on PRs |
| **develop-deploy.yml** | Push to `develop` | Deploys to `develop/` path |
| **release.yml** | Push to `main` | Creates tag, updates README, deploys to 3 locations, syncs back to develop |
| **cleanup-feature.yml** | PR merged to `develop`/`main` | Removes feature branch deployment from S3 |
| **version-check.yml** | PR to `develop` | Ensures version was bumped in package.json |

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

**IMPORTANT:** Version bumps are ONLY required for releases (develop → main), NOT for feature branches.

### ✅ When to Bump Version

**For feature branches → develop:**
- ❌ **NO version bump required**
- Feature branches merge directly to develop without version changes
- Version check workflow does NOT run on feature → develop PRs

**For develop → main (releases):**
- ✅ **Version bump REQUIRED**
- Bump version **AFTER** all features are merged to develop and you're ready to create a release
- This ensures the version bump is the last commit before the release
- Version check workflow enforces this requirement

### Workflow Example

```bash
# 1. Complete feature development
git checkout -b feature/my-feature
# ... make changes ...
git commit -m "feat: Add my feature"
git push

# 2. Create PR to develop (NO version bump needed)
gh pr create --base develop --title "Add my feature"

# 3. Merge PR to develop (no version bump)

# 4. When ready to release, bump version on develop
git checkout develop
git pull
npm version patch  # For bug fixes (1.0.1 → 1.0.2)
npm version minor  # For new features (1.0.1 → 1.1.0)
npm version major  # For breaking changes (1.0.1 → 2.0.0)
git push

# 5. Create PR from develop to main
gh pr create --base main --head develop --title "Release v1.0.2"
```

### What npm version Does

```bash
npm version patch  # Bug fix: 0.0.1 → 0.0.2
npm version minor  # New feature: 0.0.1 → 0.1.0
npm version major  # Breaking change: 0.0.1 → 1.0.0
```

This automatically:
- Updates package.json and package-lock.json
- Creates commit: "chore: Bump version to vX.X.X" (configured in .npmrc)
- Creates local git tag vX.X.X (not pushed - GitHub Actions creates remote tags)

### .npmrc Configuration

The project uses `.npmrc` to standardize version commit messages:
```ini
message=chore: Bump version to v%s
tag-version-prefix=v
```

This ensures consistent commit messages and tag prefixes across all version bumps.

### Why Version Bumping is Required (for releases only)

Every merge to `main` creates a release with a version tag. The version must be bumped to:
- Track releases properly
- Create unique version tags (e.g., `v1.0.1`, `v1.0.2`)
- Enable pinned version deployments (`/releases/v1.0.1/`)
- Generate accurate changelogs

**Note:** Version bumps are NOT required for feature → develop PRs. The version check workflow only enforces this on develop → main PRs.

| Command | Use Case | Version Change |
|---------|----------|----------------|
| `npm version patch` | Bug fixes, minor changes | 1.0.1 → 1.0.2 |
| `npm version minor` | New features, enhancements | 1.0.1 → 1.1.0 |
| `npm version major` | Breaking changes | 1.0.1 → 2.0.0 |

## Deployment Paths

Each branch deploys to a unique path on Digital Ocean Spaces:

| Branch | Deployment Path(s) | Cache Strategy |
|--------|-------------------|----------------|
| `feature/xyz` | `feature-xyz/` | no-cache |
| `hotfix/bug-123` | `hotfix-bug-123/` | no-cache |
| `develop` | `develop/` | no-cache |
| `main` | `main/`, `latest/`, `releases/v{version}/` | `releases/v*` cached forever, others no-cache |

**Example URLs:**
- Feature: `https://releases.benelliot-nice.com/cxone-expert-enhancements/feature-auto-load-css/css-editor-embed.js`
- Hotfix: `https://releases.benelliot-nice.com/cxone-expert-enhancements/hotfix-bug-123/css-editor-embed.js`
- Develop: `https://releases.benelliot-nice.com/cxone-expert-enhancements/develop/css-editor-embed.js`
- Latest: `https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor-embed.js`
- Pinned: `https://releases.benelliot-nice.com/cxone-expert-enhancements/releases/v0.0.8/css-editor-embed.js`

**Note:** Versioned releases are deployed to `releases/v{version}/` subdirectory to avoid polluting the S3 bucket root.

## Release Workflow Automation

When a PR is merged from `develop` to `main`, the release workflow automatically:

1. **Detects Version** - Reads version from `package.json`
2. **Checks for Existing Tag** - Skips release if tag `v{version}` already exists
3. **Updates README** - Replaces version URLs in README.md with new version
4. **Commits README** - Pushes README update to main (using PAT to bypass branch protection)
5. **Generates Changelog** - Extracts commits since last tag
6. **Creates Git Tag** - Tags commit as `v{version}`
7. **Deploys to S3** - Uploads to 3 locations: `main/`, `latest/`, `releases/v{version}/`
8. **Creates GitHub Release** - With changelog and deployment URLs
9. **Syncs to Develop** - Automatically merges main back into develop (prevents merge conflicts on next release)

### Why Auto-Sync to Develop?

The README update on main would normally cause main and develop to diverge, creating merge conflicts on the next release. The auto-sync step:
- Merges main → develop after each release
- Keeps branches in sync
- Prevents merge conflicts
- Uses `[skip ci]` to avoid triggering develop deployment

### Required Configuration

The workflows require these GitHub repository settings:

#### Secrets (sensitive values)

| Secret | Purpose |
|--------|---------|
| `PAT_TOKEN` | Personal Access Token with `repo` scope - bypasses branch protection for README commits |
| `AWS_ACCESS_KEY_ID` | Digital Ocean Spaces access key |
| `AWS_SECRET_ACCESS_KEY` | Digital Ocean Spaces secret key |

#### Variables (non-sensitive values)

| Variable | Purpose | Example |
|----------|---------|---------|
| `DO_SPACES_BUCKET` | Bucket name | `benelliot-nice` |
| `DO_SPACES_ENDPOINT` | Region endpoint | `syd1.digitaloceanspaces.com` |

**Why variables instead of secrets?** Secrets are automatically redacted in logs and outputs, which would hide deployment URLs in PR comments and workflow summaries. Since bucket names and endpoints are public (visible in URLs), they should be stored as variables.

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

### Branching & Merging
- ✅ **Always** create features off `develop`, not `main`
- ✅ **Always** test feature deployments before merging
- ✅ **Never** force push to `main` or `develop`
- ✅ **Never** merge feature branches directly to `main`

### Merge Strategies
- ✅ **Squash merge** feature/hotfix/bugfix branches INTO `develop` (keeps history clean)
- ✅ **Regular merge** (NOT squash) when merging `develop` INTO `main` (preserves shared history)
- ⚠️ **Why?** Squashing develop→main creates divergent history and breaks:
  - Release workflow automation
  - Auto-sync from main back to develop
  - Future merge operations (causes conflicts)

### Versioning
- ❌ **Don't** bump version for feature → develop PRs (not required)
- ✅ **Always** bump version on develop before creating release PR to `main`
- ✅ **Always** bump version before merging develop to `main`
- ❌ **Don't** skip the version bump for releases - version check will fail

### Security
- ❌ **Don't** commit `.env` file (credentials)

## Branch Protection

Branch protection rules are enabled for both `main` and `develop`:

### `main` branch:
- ✅ Require pull request before merging
- ✅ Require approvals (at least 1)
- ✅ Require status checks to pass
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
- ❌ Do not allow force pushes (except from GitHub Actions via PAT)
- ❌ Do not allow deletions

**Note:** GitHub Actions uses `PAT_TOKEN` secret to bypass "Require pull request" protection for automated README commits during releases.

### `develop` branch:
- ✅ Require pull request before merging
- ✅ Require status checks to pass (if any)
- ❌ Do not allow force pushes (except from GitHub Actions via PAT)
- ❌ Do not allow deletions

**Note:** GitHub Actions uses `PAT_TOKEN` to push auto-sync merge commits from main after releases.

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

### Release workflow doesn't trigger on main

**Problem:** Merged PR to main but release workflow didn't run.

**Cause:** GitHub Actions doesn't run workflows when they're modified in the same commit/PR as a security measure.

**Fix:**
```bash
# Make an empty commit to trigger workflow
git checkout main
git pull
git commit --allow-empty -m "chore: Trigger release workflow"
git push
```

### Auto-sync to develop fails

**Problem:** Release workflow completes but doesn't merge main back to develop.

**Check:**
1. `PAT_TOKEN` secret is configured in repository settings
2. PAT has `repo` scope
3. PAT hasn't expired
4. Check Actions tab for error details

**Fix:**
```bash
# Manually sync develop with main
git checkout develop
git pull
git merge main -m "chore: Manual sync from main"
git push
```

### README not updating during release

**Problem:** Release created but README still has old version.

**Check:**
1. README contains version URLs matching pattern: `releases/v[0-9]*\.[0-9]*\.[0-9]*/`
2. Tag doesn't already exist (workflow skips if tag exists)
3. `PAT_TOKEN` secret is configured

**Fix:**
```bash
# Manually update README on main
git checkout main
git pull
# Edit README.md to update version URLs
git add README.md
git commit -m "docs: Update README with v0.0.X pinned version [skip ci]"
git push
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
# URL: https://releases.benelliot-nice.com/cxone-expert-enhancements/feature-test-deploy/css-editor-embed.js

# 6. Check PR comment for deployment URLs (if PR was created)
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

# 4. Verify workflow completes:
# - Check Actions tab for "Release and Deploy Main"
# - Tag created: v0.0.2
# - Release created on GitHub
# - README updated with v0.0.2 URLs
# - Deployed to: main/, latest/, releases/v0.0.2/
# - Develop branch synced with main (no conflicts)

# 5. Test deployments:
# https://releases.benelliot-nice.com/cxone-expert-enhancements/latest/css-editor-embed.js
# https://releases.benelliot-nice.com/cxone-expert-enhancements/releases/v0.0.2/css-editor-embed.js
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
