# Deployment Guide

This guide covers deployment configuration, CI/CD workflows, and release management for CXone Expert Enhancements.

## Deployment Architecture

The project uses **GitHub Actions** for automated CI/CD and **Digital Ocean Spaces** (S3-compatible storage) as a CDN for hosting files.

### Deployment Paths

Each branch automatically deploys to its own path:

| Branch Type | Example | Deployment Path | Cache Strategy |
|-------------|---------|-----------------|----------------|
| `main` | `main` | `main/`, `latest/`, `releases/v{version}/` | `releases/v*` cached forever |
| `develop` | `develop` | `develop/` | no-cache |
| Feature | `feature/my-feature` | `feature-my-feature/` | no-cache |
| Hotfix | `hotfix/bug-123` | `hotfix-bug-123/` | no-cache |
| Bugfix | `bugfix/issue-456` | `bugfix-issue-456/` | no-cache |
| Other | `any-branch-name` | `any-branch-name/` | no-cache |

### Example URLs

```
https://releases.benelliot-nice.com/cxone-expert-enhancements/
├── main/
│   ├── embed.js                                         (bundled JS)
│   └── core.css                                         (bundled CSS)
├── latest/
│   ├── embed.js                                         (latest release - auto-updates)
│   └── core.css
├── releases/
│   ├── v1.2.0/
│   │   ├── embed.js                                     (pinned version - immutable)
│   │   └── core.css
│   ├── v1.1.0/
│   └── v1.0.0/
├── develop/
│   ├── embed.js                                         (develop branch)
│   └── core.css
├── feature-auto-load-css/
│   ├── embed.js                                         (feature branch)
│   └── core.css
├── hotfix-bug-123/
└── bugfix-issue-456/
```

## GitHub Actions Workflows

### 1. Feature Deploy (`feature-deploy.yml`)

**Triggers:** Push to any branch except `main` and `develop`

**What it does:**
- Sanitizes branch name (only `a-z`, `0-9`, `-`, `_`, `/` allowed)
- Deploys all files from `/dist/` to `{sanitized-branch-name}/`
- Comments on PRs with deployment URLs
- Sets `Cache-Control: no-cache` headers

**Use cases:**
- Testing feature branches before merging
- Sharing work-in-progress with team
- QA testing specific branches

### 2. Develop Deploy (`develop-deploy.yml`)

**Triggers:** Push to `develop` branch

**What it does:**
- Deploys all files from `/dist/` to `develop/`
- Creates deployment summary
- Sets `Cache-Control: no-cache` headers

**Use cases:**
- Integration testing
- Pre-release validation
- Testing features merged but not yet released

### 3. Release (`release.yml`)

**Triggers:** Push to `main` branch

**What it does:**
1. Reads version from `package.json`
2. Checks if tag `v{version}` already exists (skips if yes)
3. Updates README.md with new version URLs
4. Commits README update to main (using PAT to bypass protection)
5. Generates changelog from commits since last tag
6. Creates git tag `v{version}`
7. Deploys to 3 locations:
   - `main/` (no-cache)
   - `latest/` (no-cache)
   - `releases/v{version}/` (cached forever)
8. Creates GitHub Release with changelog and URLs
9. Syncs main back to develop (keeps branches in sync)

**Use cases:**
- Production releases
- Creating immutable versioned deployments
- Auto-generating changelogs

### 4. Cleanup Feature (`cleanup-feature.yml`)

**Triggers:** PR merged to `develop` or `main`

**What it does:**
- Removes feature branch deployment from S3
- Keeps storage clean

## GitHub Repository Configuration

### Required Secrets

Configure these in: **Settings → Secrets and variables → Actions → Repository secrets**

| Secret Name | Description | Where to Get |
|-------------|-------------|--------------|
| `PAT_TOKEN` | Personal Access Token with `repo` scope | GitHub → Settings → Developer settings → Personal access tokens |
| `AWS_ACCESS_KEY_ID` | Digital Ocean Spaces Access Key | Digital Ocean → Spaces → API |
| `AWS_SECRET_ACCESS_KEY` | Digital Ocean Spaces Secret Key | Digital Ocean → Spaces → API |

### Required Variables

Configure these in: **Settings → Secrets and variables → Actions → Repository variables**

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `DO_SPACES_BUCKET` | `benelliot-nice` | Bucket name |
| `DO_SPACES_ENDPOINT` | `syd1.digitaloceanspaces.com` | Region endpoint |

**Why variables instead of secrets?**
Secrets are redacted in logs, which would hide deployment URLs in PR comments. Since bucket names and endpoints are public (visible in URLs), they should be stored as variables.

### Branch Protection Rules

**`main` branch:**
- ✅ Require pull request before merging
- ✅ Require approvals (at least 1)
- ✅ Require status checks to pass
- ✅ Require conversation resolution
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

**Exception:** GitHub Actions uses `PAT_TOKEN` to bypass "Require pull request" for automated README commits during releases.

**`develop` branch:**
- ✅ Require pull request before merging
- ✅ Require status checks to pass
- ❌ Do not allow force pushes
- ❌ Do not allow deletions

**Exception:** GitHub Actions uses `PAT_TOKEN` to push auto-sync merge commits from main after releases.

## Branch Naming Conventions

While any branch name works, follow these conventions for clean deployment URLs:

✅ **Good:**
- `feature/user-auth` → `feature-user-auth/`
- `hotfix/bug-123` → `hotfix-bug-123/`
- `bugfix/issue-456` → `bugfix-issue-456/`
- `refactor/cleanup-css` → `refactor-cleanup-css/`

⚠️ **Works but ugly:**
- `mybranch` → `mybranch/`
- `test123` → `test123/`
- `quick-fix` → `quick-fix/`

❌ **Avoid (special chars are stripped):**
- `test@#$%` → `test-----/`
- `my_branch!` → `my_branch-/`

**Rules:**
- Only `a-z`, `0-9`, `-`, `_`, `/` are preserved
- Other characters → replaced with `-`
- Use lowercase, descriptive names
- Use slashes for categorization

## Local Deployment

### Prerequisites

1. Create `.env` file:
```bash
cp .env.example .env
```

2. Add your Digital Ocean Spaces credentials to `.env`:
```env
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
DO_SPACES_BUCKET=benelliot-nice
DO_SPACES_ENDPOINT=syd1.digitaloceanspaces.com
```

### Deploy Current Branch

```bash
npm run deploy
```

This uploads all files from `/dist/` to a path based on your current branch name.

**Example:**
- On `feature/my-feature` → deploys to `feature-my-feature/`
- On `develop` → deploys to `develop/`
- On `main` → deploys to `main/` only (GitHub Actions handles the rest)

### Manual Deployment (Advanced)

```bash
# Override deployment path
GITHUB_REF_NAME=custom-path npm run deploy

# Deploy CSS files only
npm run deploy:css
```

## Creating a Release

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md#creating-a-release) for the complete release workflow.

**Quick steps:**

1. Merge all features to `develop`
2. Bump version on `develop`:
   ```bash
   git checkout develop
   git pull
   npm version patch  # or minor/major
   git push
   ```
3. Create PR from `develop` → `main`
4. Merge PR → triggers release workflow automatically

## Troubleshooting

### Deployment Fails

**Check GitHub Actions logs:**
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Check error logs

**Common issues:**
- Missing or invalid secrets
- Network timeout
- Permissions errors

**Solutions:**
- Verify secrets in repository settings
- Check Digital Ocean Spaces status
- Ensure PAT_TOKEN has `repo` scope

### Release Not Created

**Problem:** Merged to main but no release created

**Possible causes:**
1. Version in `package.json` wasn't bumped
2. Tag `v{version}` already exists
3. Workflow failed (check Actions tab)

**Solution:**
```bash
# Bump version and try again
git checkout develop
git pull
npm version patch
git push
gh pr create --base main --head develop --title "Release v{version}"
```

### Auto-Sync to Develop Fails

**Problem:** Release created but main not synced back to develop

**Check:**
- `PAT_TOKEN` configured correctly
- PAT has `repo` scope and hasn't expired
- Check Actions tab for errors

**Manual fix:**
```bash
git checkout develop
git pull
git merge main -m "chore: Manual sync from main [skip ci]"
git push
```

### README Not Updated

**Problem:** Release created but README has old version

**Check:**
- PAT_TOKEN configured
- README contains version URLs matching pattern `releases/v[0-9]*\.[0-9]*\.[0-9]*/`

**Manual fix:**
```bash
git checkout main
git pull
# Edit README.md to update version URLs
git add README.md
git commit -m "docs: Update README with v{version} pinned version [skip ci]"
git push
```

### Feature Branch Not Deploying

**Check:**
1. Workflow is enabled (Actions tab)
2. Branch name is valid (no special characters)
3. Check Actions tab for workflow run
4. Verify secrets are configured

## Cache Strategy

### Versioned Releases (`releases/v*/`)
- **Cache:** Forever (immutable)
- **CDN:** Full caching enabled
- **Use case:** Pinned versions that never change

### Everything Else (`main/`, `latest/`, `develop/`, feature branches)
- **Cache:** No cache (`Cache-Control: no-cache`)
- **CDN:** Always fetches latest version
- **Use case:** Auto-updating deployments

## Security Notes

- Never commit `.env` file (in `.gitignore`)
- Rotate credentials periodically
- Use PAT with minimal required scopes (`repo` only)
- Review GitHub Actions logs for exposed secrets (shouldn't happen, but check)

## Cost Considerations

**Digital Ocean Spaces:**
- Storage: ~$0.02/GB/month
- Bandwidth: ~$0.01/GB (after 1TB free)

**Typical costs for this project:** < $1/month

**Optimization:**
- Feature branch cleanup workflow removes old deployments
- Only 3 permanent paths: `main/`, `latest/`, versioned releases
