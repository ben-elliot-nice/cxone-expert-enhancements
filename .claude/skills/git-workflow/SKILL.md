---
name: git-workflow
description: Git workflow management for projects using main/develop branching strategy with PR-based integration, automated builds, and strict merge policies. Handles branch creation, syncing, merge restrictions, build verification, PR workflows, and cleanup.
allowed-tools: Bash, Read, Glob, Grep
---

# Git Workflow Skill

This skill enforces a structured git workflow with main/develop branching, PR-based integration, and automated quality checks.

**Scope**: This skill handles ONLY git operations (branching, merging, committing, pushing, PRs) and build/test verification. Code implementation is handled by other specialized skills - this skill manages the workflow around that implementation.

## Core Principles

1. **Always fetch first**: Run `git fetch` before any git operations to ensure remote information is up to date
2. **Worktree aware**: Don't automatically pull (may be working with worktrees where branches are checked out elsewhere)
3. **Quality gates**: Build (and test if available) before pushing
4. **PR-based integration**: Critical merges require pull requests for review
5. **Clean history**: Different strategies for different branch types

## Branch Strategy

### Branch Types and Purposes

- **main**: Release-ready production code
  - Only contains merge commits (no squashes)
  - Tagged for releases
  - Protected - no direct feature merges

- **develop**: Staging/deployment branch
  - Integration branch for features
  - Squashed feature commits for clean history
  - Protected - no direct feature merges

- **feature/**: New functionality
- **fix/**: Bug fixes
- **hotfix/**: Urgent fixes (still branch from develop)
- **refactor/**: Code improvements

All work branches originate from `develop`.

### Branch Naming Convention

Format: `<type>/<issue>-<description>`

Examples:
- `feature/123-user-authentication`
- `fix/456-login-validation`
- `hotfix/789-security-patch`
- `refactor/101-api-cleanup`

If a GitHub issue is associated with the work, include the issue number in the branch name.

## Merge Rules (CRITICAL)

### ❌ FORBIDDEN - Must Use Pull Requests

**NEVER directly merge these - ALWAYS create a PR:**

1. **feature/fix/hotfix/refactor → develop**
   - MUST be via Pull Request
   - PR will be squashed on merge
   - Ensures code review and clean develop history

2. **develop → main**
   - MUST be via Pull Request
   - Regular merge (no squash) to preserve develop's clean history
   - Ensures release review

### ✅ ALLOWED - Direct Merges

Claude CAN directly merge in these cases:

1. **main → develop**
   - Keeps develop in sync with production
   - Use regular merge (no squash)
   - Do this when develop falls behind main

2. **develop → feature/fix/hotfix/refactor**
   - Keeps work branches up to date
   - Prevents merge conflicts
   - Use regular merge (no squash)

## Automated Branch Creation

Claude should infer when to create a new work branch based on:

1. **Context indicates new work**: Conversation involves implementing a new feature, fix, refactor, etc.
2. **Currently on base branch**: Working directory is on `develop` or `main`
3. **No existing branch**: No relevant branch exists locally or remotely

### Branch Creation Process

```bash
# 1. Always fetch first
git fetch

# 2. Ensure on develop
git checkout develop

# 3. Create and checkout new branch
git checkout -b <type>/<issue>-<description>
```

## Development Workflow

### Standard Feature Development Process

**Note**: This skill manages the git workflow. Code implementation is handled by other specialized skills.

1. **Fetch remote updates**
   ```bash
   git fetch
   ```

2. **Create or checkout work branch** (if needed - see "Automated Branch Creation")

3. **Proactive syncing** (if branch is behind and conflicts likely)
   ```bash
   git merge develop  # to keep feature branch up to date
   ```

4. **Code changes** - Hand off to other skills for implementation, then resume when changes are complete

5. **Build verification**
   - Auto-detect build command from project files:
     - `package.json`: Use `npm run build` or `yarn build`
     - `Cargo.toml`: Use `cargo build`
     - `Makefile`: Use `make` or `make build`
     - `pom.xml`: Use `mvn package`
     - Other project-specific indicators
   - Run the build command
   - If build fails:
     - **Simple errors** (syntax, typos, missing imports): Hand back to code implementation skills
     - **Complex errors** (logic issues, architecture problems): Pause and ask for guidance

6. **Test verification** (if test command exists)
   - Auto-detect test command:
     - `package.json`: Look for `npm test` or `npm run test`
     - `Cargo.toml`: Use `cargo test`
     - `Makefile`: Use `make test`
     - Other test scripts
   - Run tests if command found, skip if not
   - Same failure handling as builds

7. **Commit changes**
   - Use clear, descriptive commit messages
   - Include issue number when applicable
   - No specific format required - use Claude's standard approach

8. **Push to remote**
   ```bash
   git push -u origin <branch-name>
   ```

9. **Create Pull Request**
   ```bash
   gh pr create --title "Brief description" --body "$(cat <<'EOF'
   ## Summary
   - List of changes made
   - Reference to issue if applicable

   ## Testing
   - Build: ✓ Passed
   - Tests: ✓ Passed (or ✓ N/A)
   EOF
   )"
   ```

10. **PAUSE** - Wait for user instruction
    - User may request additional changes (repeat process)
    - User may inform that PR has been merged

## Post-Merge Cleanup

After user confirms the PR has been merged:

1. **Fetch develop**
   ```bash
   git fetch
   git checkout develop
   git pull origin develop
   ```

2. **Delete feature branch** (local and remote)
   ```bash
   git branch -d <branch-name>
   git push origin --delete <branch-name>
   ```

## Proactive Branch Syncing

Sync branches when conflicts are likely:

### When to Sync develop → feature

Merge develop into feature branch when:
- The feature branch is behind develop by multiple commits
- Changes in develop overlap with areas the feature touches
- Before creating a PR (ensures clean merge)

```bash
git fetch
git checkout <feature-branch>
git merge develop
```

### When to Sync main → develop

Merge main into develop when:
- main has moved ahead (e.g., hotfix was merged)
- Before creating a develop → main PR
- To ensure develop has all production changes

```bash
git fetch
git checkout develop
git merge main
```

## Special Scenarios

### Working with GitHub Issues

When a GitHub issue seeds the feature:
- Include issue number in branch name: `feature/123-description`
- Reference issue in PR description
- PR title should clearly indicate what issue it addresses

### Multiple Features in Parallel

- Each feature gets its own branch from develop
- Keep track of which branch is currently active
- Fetch before switching branches to ensure latest remote info

### Build/Test Command Not Found

If auto-detection fails:
- Ask user what build/test command to use
- Document it for future reference in the conversation

### Emergency Situations

If absolutely necessary to break workflow (with explicit user permission):
- Document why the standard workflow was bypassed
- Ensure user is aware of the deviation
- Return to standard workflow immediately after

## Reminders

- Remote is assumed to be `origin`
- Always `git fetch` before operations
- Never use `git pull` on develop/main if worktrees might be involved
- PRs for feature → develop are ALWAYS squashed
- PRs for develop → main are NEVER squashed
- Main should only contain merge commits for clean release history
- Pause after creating PR - don't continue without user instruction
