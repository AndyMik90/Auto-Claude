# AI Workflows Guide

This repository uses three complementary AI workflows for automated issue resolution and code review.

## Workflows Overview

| Workflow | File | Purpose | Trigger | Best For |
|----------|------|---------|---------|----------|
| **OpenHands Auto-Fix** | `ai-openhands-resolver.yml` | Automatically implements fixes and creates PRs | `fix-me` label or `@openhands-agent` mention | Breaking issues, mock removal, feature implementation |
| **CodeRabbit Review** | `ai-coderabbit-review.yml` | Automated code quality reviews | PR opened/updated | Code review, best practices, security analysis |
| **GitHub Copilot Assign** | `ai-copilot-assign.yml` | Auto-assigns new issues to Copilot | Issue created | Initial triage, implementation guidance |
| **OpenHands PR Review** | `ai-openhands-review.yml` | Deep PR analysis with Claude Sonnet 4.5 | `ai-review` label or `openhands-agent` reviewer | Detailed PR review, architectural feedback |

## Workflow Details

### 1. OpenHands Auto-Fix Resolver (NEW)

**Purpose:** Automatically implements code changes to fix issues and creates draft PRs.

**How to Use:**
- Add the `fix-me` label to an issue, OR
- Comment `@openhands-agent` on an issue (owner/collaborator/member only)

**What Happens:**
1. OpenHands analyzes the issue and repository context
2. Implements a fix using Claude Sonnet 4.5
3. Creates a draft PR with the changes (on success)
4. OR creates a branch with attempted changes (on partial success)
5. Comments on the issue with results and links

**Configuration:**
- **Model:** `anthropic/claude-sonnet-4-20250514`
- **Max Iterations:** 50
- **Target Branch:** main
- **PR Type:** draft

**Required Secrets:**
- `LLM_API_KEY` - Anthropic API key for Claude Sonnet 4.5
- `PAT_TOKEN` (optional) - Personal Access Token for creating PRs (falls back to GITHUB_TOKEN)
- `PAT_USERNAME` (optional) - Username for git commits (defaults to 'openhands-agent')
- `LLM_BASE_URL` (optional) - Custom LLM API endpoint

**Best For:**
- Mock removal issues (issues #99, #101-104)
- Breaking functionality issues
- Feature implementations with clear requirements
- Refactoring tasks

**Example Usage:**
```bash
# Add label to trigger auto-fix
gh issue edit 99 --add-label "fix-me"

# OR mention in comment
gh issue comment 99 --body "@openhands-agent Please fix this issue"
```

---

### 2. CodeRabbit Code Review

**Purpose:** Automated code quality and best practices review on pull requests.

**How to Use:**
- Automatically triggers when a PR is opened, synchronized, or reopened
- Responds to `@coderabbitai` commands in PR comments

**What Happens:**
1. Analyzes all changed files in the PR
2. Provides inline comments on potential issues
3. Suggests improvements for code quality, security, and best practices
4. Responds to follow-up questions via `@coderabbitai` mentions

**Commands:**
- `@coderabbitai review` - Trigger incremental review
- `@coderabbitai full review` - Complete review from scratch
- `@coderabbitai summary` - Regenerate PR summary

**Configuration:**
- **Auto Review:** Enabled
- **Review Level:** Detailed
- **Review Scope:** Changed files only

**Required Secrets:**
- `CODERABBIT_TOKEN` - CodeRabbit API token

**Best For:**
- Code quality reviews
- Security vulnerability detection
- Best practices enforcement
- Learning opportunities

**Note:** CodeRabbit works **only on pull requests**, not on issues.

---

### 3. GitHub Copilot Auto-Assign

**Purpose:** Automatically assigns new issues to GitHub Copilot for initial analysis.

**How to Use:**
- Automatically triggers when a new issue is created
- No manual action required

**What Happens:**
1. Assigns the issue to the 'Copilot' user
2. Adds a comment explaining the auto-assignment
3. Copilot provides implementation guidance (if available)

**Configuration:**
- **Trigger:** Issue created
- **Assignee:** Copilot user
- **Timeout:** 5 minutes

**Best For:**
- Initial issue triage
- Quick implementation suggestions
- Understanding issue context

---

### 4. OpenHands PR Review

**Purpose:** Deep pull request analysis using Claude Sonnet 4.5 via litellm proxy.

**How to Use:**
- Add the `ai-review` label to a PR, OR
- Request review from `openhands-agent` user

**What Happens:**
1. Checks out PR code
2. Installs OpenHands SDK
3. Runs comprehensive PR review using Claude Sonnet 4.5
4. Posts review summary comment

**Configuration:**
- **Model:** `litellm_proxy/claude-sonnet-4-5-20250929`
- **Base URL:** `https://llm-proxy.app.all-hands.dev`
- **Timeout:** 30 minutes

**Required Secrets:**
- `LLM_API_KEY` - LiteLLM proxy API key

**Best For:**
- Architectural reviews
- Complex PR analysis
- Design decision feedback

---

## Workflow Comparison: Issues vs Pull Requests

### For Issues (Auto-Fix)

**Best Workflow:** OpenHands Auto-Fix Resolver

**Usage:**
```bash
# Add fix-me label
gh issue edit <issue-number> --add-label "fix-me"

# OR comment with @openhands-agent
gh issue comment <issue-number> --body "@openhands-agent Please implement this feature"
```

**Expected Outcome:**
- Automated implementation
- Draft PR created
- Ready for review

### For Pull Requests (Code Review)

**Available Workflows:**

1. **CodeRabbit** (Automatic)
   - Triggers on PR open/update
   - Provides inline code review
   - Security and best practices

2. **OpenHands Review** (Manual Trigger)
   - Add `ai-review` label
   - OR request review from `openhands-agent`
   - Deep architectural analysis

**Usage:**
```bash
# CodeRabbit automatically reviews all PRs

# Trigger OpenHands review
gh pr edit <pr-number> --add-label "ai-review"
# OR
gh pr review <pr-number> --request-reviewer openhands-agent
```

---

## Recommended Workflow for Mock Removal Issues

For issues #99, #101, #102, #103, and #104 (mock removal):

### Step 1: Trigger Auto-Fix
```bash
gh issue edit 99 --add-label "fix-me"
gh issue edit 101 --add-label "fix-me"
gh issue edit 102 --add-label "fix-me"
gh issue edit 103 --add-label "fix-me"
gh issue edit 104 --add-label "fix-me"
```

### Step 2: Monitor Progress
- OpenHands will comment when it starts working
- Check workflow runs: https://github.com/joelfuller2016/Auto-Claude/actions
- Wait for draft PR creation (usually 30-60 minutes)

### Step 3: Review Draft PR
- CodeRabbit automatically reviews the PR
- Check inline comments and suggestions
- Test the implementation locally

### Step 4: Request Deep Review (Optional)
```bash
gh pr edit <pr-number> --add-label "ai-review"
```

### Step 5: Merge or Iterate
- If satisfied, mark PR as ready for review and merge
- If changes needed, comment on the PR with feedback
- OpenHands can iterate based on review comments

---

## Setup Requirements

### Required Repository Secrets

| Secret | Used By | How to Get |
|--------|---------|------------|
| `LLM_API_KEY` | OpenHands workflows | [Anthropic Console](https://console.anthropic.com/) → API Keys |
| `CODERABBIT_TOKEN` | CodeRabbit | [CodeRabbit Settings](https://app.coderabbit.ai/) → API Token |
| `PAT_TOKEN` | OpenHands (optional) | GitHub Settings → Developer Settings → Personal Access Tokens → Fine-grained token with `contents`, `issues`, `pull-requests`, `workflows` permissions |
| `PAT_USERNAME` | OpenHands (optional) | Your GitHub username for commit attribution |
| `LLM_BASE_URL` | OpenHands (optional) | Custom LLM API endpoint (defaults to Anthropic API) |

### Setting Secrets

```bash
# Via GitHub CLI
gh secret set LLM_API_KEY -b "sk-ant-api03-..."
gh secret set CODERABBIT_TOKEN -b "crab_..."
gh secret set PAT_TOKEN -b "github_pat_..."
gh secret set PAT_USERNAME -b "your-username"

# Or via GitHub UI: Settings → Secrets and variables → Actions → New repository secret
```

---

## Troubleshooting

### OpenHands Auto-Fix Issues

**Problem:** Workflow fails with "LLM_API_KEY not set"
**Solution:** Add `LLM_API_KEY` secret to repository secrets

**Problem:** PR creation fails with permission error
**Solution:** Add `PAT_TOKEN` secret with proper permissions

**Problem:** Auto-fix produces incorrect code
**Solution:**
1. Review the branch created by OpenHands
2. Comment on the issue with specific feedback
3. Mention `@openhands-agent` to trigger another attempt with your feedback

### CodeRabbit Issues

**Problem:** CodeRabbit not reviewing PRs
**Solution:** Check that `CODERABBIT_TOKEN` is set correctly

**Problem:** CodeRabbit not responding to commands
**Solution:**
1. Ensure you're using `@coderabbitai` (not `@coderabbit`)
2. Verify you're commenting on a **pull request**, not an issue

### OpenHands Review Issues

**Problem:** Review not triggering
**Solution:**
1. Verify `ai-review` label is added to **PR** (not issue)
2. Check that `LLM_API_KEY` secret is set

---

## Best Practices

1. **Use fix-me for clear, well-defined issues** - The better the issue description, the better the auto-fix
2. **Review auto-generated PRs carefully** - AI is powerful but not perfect
3. **Combine workflows** - Use auto-fix for implementation, CodeRabbit for review
4. **Iterate with feedback** - Comment on PRs/issues to guide AI improvements
5. **Monitor costs** - Each auto-fix can consume significant LLM tokens
6. **Keep secrets secure** - Never commit API keys to the repository

---

## Cost Estimation

### OpenHands Auto-Fix
- **Per issue:** ~$0.50-$2.00 (depends on complexity, max 50 iterations)
- **Model:** Claude Sonnet 4.5 ($3/MTok input, $15/MTok output)

### CodeRabbit
- **Pricing:** See [CodeRabbit Pricing](https://coderabbit.ai/pricing)
- **Free tier:** Available for open-source projects

### OpenHands Review
- **Per PR:** ~$0.20-$0.80 (depends on PR size)
- **Model:** Claude Sonnet 4.5 via litellm proxy

---

## Future Enhancements

- [ ] Add auto-fix retry logic for failed attempts
- [ ] Integrate with Linear for automated task tracking
- [ ] Add cost monitoring and budget limits
- [ ] Create custom OpenHands plugins for project-specific patterns
- [ ] Implement auto-fix for test failures in CI/CD

---

## References

- [OpenHands Documentation](https://docs.openhands.dev/)
- [OpenHands GitHub Action](https://docs.openhands.dev/openhands/usage/run-openhands/github-action)
- [CodeRabbit Documentation](https://docs.coderabbit.ai/)
- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Claude API Documentation](https://docs.anthropic.com/en/api/getting-started)

---

**Last Updated:** 2026-01-01
**Maintained By:** @joelfuller2016
