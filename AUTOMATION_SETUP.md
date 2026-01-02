# Auto-Claude GitHub Automation Setup Guide

Complete guide for setting up the AI-powered automation pipeline in Auto-Claude using CodeRabbit, GitHub Copilot, and OpenHands.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Testing the Automation](#testing-the-automation)
- [Workflow Reference](#workflow-reference)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

---

## Overview

Auto-Claude now includes a **complete GitHub automation pipeline** that automatically:

1. **Plans** features and bugs using CodeRabbit AI
2. **Implements** features using GitHub Copilot (with adaptive timeouts)
3. **Escalates** to OpenHands if Copilot doesn't respond in time
4. **Reviews** PRs with dual AI reviewers (CodeRabbit + OpenHands)
5. **Fixes** review issues automatically
6. **Merges** clean PRs when all checks pass

**Zero manual intervention required** for most issues and PRs.

### Dual AI Review System

PRs benefit from **two complementary AI reviewers**:
- **CodeRabbit** - Fast, comprehensive review (style, security, best practices)
- **OpenHands** - Deep code analysis (logic, architecture, correctness)

This dual approach provides maximum coverage and catches issues that single reviewers might miss.

---

## Architecture

### Automation Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Issue/PR Created                                     │
│    └─ Labels: auto-implement, needs-plan               │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 2. CodeRabbit Auto-Plan                                 │
│    └─ Creates detailed implementation plan             │
│    └─ Estimates complexity (simple/medium/complex)     │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Copilot Auto-Assign                                  │
│    └─ Copilot starts implementation                    │
│    └─ Timeout: 1.5h (simple), 3h (medium), 6h (complex)│
│    └─ Re-pings up to 3 times if no PR                  │
└─────────────┬───────────────────────────────────────────┘
              │
              ├─ PR Created → Go to step 5
              │
              ├─ No PR after 3 re-pings → Go to step 4
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 4. OpenHands Escalation                                 │
│    └─ Takes over implementation                        │
│    └─ Uses DeepSeek R1 ($0.30/1M tokens)              │
│    └─ Creates PR with comprehensive fixes              │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Dual AI Review (Parallel)                           │
│    ├─ CodeRabbit: Fast review (style, security)       │
│    └─ OpenHands: Deep review (logic, architecture)    │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Auto-Fix & Auto-Merge                               │
│    └─ OpenHands fixes review issues (if labeled)       │
│    └─ Auto-merges when all checks pass                │
└─────────────────────────────────────────────────────────┘
```

### Key Workflows

| Workflow | Trigger | Purpose | Frequency |
|----------|---------|---------|-----------|
| **master-automation-controller.yml** | Schedule (every 30min) | Master orchestrator, processes all open issues/PRs | 30 min |
| **unified-ai-automation.yml** | Issue comment | Detects CodeRabbit plan completion, assigns Copilot | Event |
| **classify-issue-complexity.yml** | Issue labeled | AI-driven complexity classification | Event |
| **copilot-reprompt-stale.yml** | Schedule (every 15min) | Re-pings Copilot if no PR, escalates after 3 tries | 15 min |
| **issue-status-checker.yml** | Schedule (every 15min) | Comprehensive issue lifecycle monitoring | 15 min |
| **openhands-fix-issues.yml** | Issue labeled `fix-me` | Triggers OpenHands to fix issues/PRs | Event |
| **openhands-pr-review.yml** | PR opened/updated | Deep AI code review (complements CodeRabbit) | Event |
| **spec-driven-autofix.yml** | Issue labeled `auto-fix` | Spec-based fix automation | Event |

---

## Prerequisites

### 1. GitHub Apps & Integrations

Install these GitHub Apps on your repository:

| App | Purpose | Installation Link |
|-----|---------|-------------------|
| **CodeRabbit AI** | Automatic PR reviews and issue planning | [Install CodeRabbit](https://github.com/apps/coderabbitai) |
| **GitHub Copilot** | Code generation (requires subscription) | [GitHub Copilot](https://github.com/features/copilot) |
| **OpenHands** (optional) | Autonomous coding agent for escalations | [OpenHands](https://github.com/apps/openhands) |

### 2. API Keys

You'll need:

1. **OpenRouter API Key** - For DeepSeek R1 (used by OpenHands)
   - Sign up at: https://openrouter.ai/
   - Get API key: https://openrouter.ai/keys
   - Cost: ~$0.30/1M input tokens (10-50x cheaper than Claude/GPT-4)

2. **GitHub Personal Access Token (PAT)** - For Copilot assignment
   - Create at: https://github.com/settings/tokens
   - Scopes required: `repo`, `workflow`, `write:packages`
   - Use fine-grained token (recommended) or classic token

### 3. Repository Settings

Ensure these settings are enabled:

- **Actions** → Allow actions to create and approve pull requests: ✅
- **Actions** → Workflow permissions: Read and write permissions ✅
- **Branches** → Require status checks before merging: ✅ (optional but recommended)

---

## Installation

### Step 1: Verify Files are in Place

All workflow files should already be in `.github/workflows/`:

```bash
ls -la .github/workflows/

# You should see:
# master-automation-controller.yml
# unified-ai-automation.yml
# classify-issue-complexity.yml
# copilot-reprompt-stale.yml
# issue-status-checker.yml
# openhands-fix-issues.yml
# spec-driven-autofix.yml
# ... (other existing workflows)
```

Issue templates should be in `.github/ISSUE_TEMPLATE/`:

```bash
ls -la .github/ISSUE_TEMPLATE/

# You should see:
# bug_report.yml
# feature_request.yml
```

### Step 2: Install GitHub Apps

1. **Install CodeRabbit:**
   - Visit: https://github.com/apps/coderabbitai
   - Click "Install" or "Configure"
   - Select your repository
   - Grant permissions

2. **Install OpenHands** (optional but recommended):
   - Visit: https://github.com/apps/openhands
   - Follow installation steps
   - Grant necessary permissions

### Step 3: Configure Repository Secrets

Go to **Settings → Secrets and variables → Actions** and add:

#### Required Secrets

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | https://openrouter.ai/keys |
| `PAT_TOKEN` | GitHub Personal Access Token | https://github.com/settings/tokens |
| `PAT_USERNAME` | Your GitHub username | Your username (e.g., `joelfuller2016`) |

#### Optional Secrets

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `COPILOT_PAT` | Separate PAT for Copilot | If you want different token for Copilot assignment |
| `LINEAR_API_KEY` | Linear API key | If using Linear integration |
| `ACTIONS_STEP_DEBUG` | `true` | Enable debug logging in workflows |
| `ACTIONS_RUNNER_DEBUG` | `true` | Enable runner debug logging |

### Step 4: Enable Workflows

1. Go to **Actions** tab in your repository
2. You should see all workflows listed
3. If any workflow is disabled, enable it
4. Check that workflows can run:
   ```bash
   # Trigger a test run (optional)
   gh workflow run master-automation-controller.yml
   ```

---

## Configuration

### CodeRabbit Configuration

The `.coderabbit.yaml` file is already configured with aggressive review mode. You can customize:

```yaml
# .coderabbit.yaml
reviews:
  profile: "assertive"  # or "chill" for fewer comments
  request_changes_workflow: true  # Request changes for security issues
  auto_review:
    enabled: true
    drafts: true  # Review draft PRs for early feedback

issues:
  auto_plan: true        # ✅ CRITICAL - Auto-create plans for issues
  enrichment: true       # Add context to issue descriptions
  add_checklist: true    # Add acceptance criteria checklist
```

### Complexity Classification

Edit `.github/workflows/classify-issue-complexity.yml` to customize complexity thresholds:

```javascript
// Simple signals (1.5 hour timeout)
const simpleSignals = ['typo', 'spelling', 'rename', 'format', 'cleanup'];

// Complex signals (6 hour timeout)
const complexSignals = ['refactor', 'architecture', 'security', 'database', 'multi-file'];

// File count thresholds
if (filesChanged === 1) complexity = 'simple';
else if (filesChanged >= 5) complexity = 'complex';
```

### Copilot Timeout Customization

Edit `.github/workflows/copilot-reprompt-stale.yml` to adjust timeouts:

```javascript
const TIMEOUT_BY_COMPLEXITY = {
  'complexity:simple': 1.5,   // 90 minutes
  'complexity:medium': 3,     // 180 minutes
  'complexity:complex': 6     // 360 minutes
};
```

---

## Testing the Automation

### Test 1: Simple Bug Report

1. Create a new issue using the Bug Report template
2. Fill in the form:
   - **Bug Description**: "Typo in README.md - 'Auot-Claude' should be 'Auto-Claude'"
   - **Component**: Documentation
   - **Severity**: Low
3. Submit the issue
4. **Expected behavior:**
   - CodeRabbit adds a detailed implementation plan within 1-2 minutes
   - Copilot is auto-assigned within 5 minutes
   - Copilot creates PR within 30-90 minutes
   - PR is auto-merged if tests pass

### Test 2: Feature Request

1. Create a new issue using the Feature Request template
2. Fill in:
   - **Problem Statement**: "Need dark mode toggle in settings"
   - **Proposed Solution**: "Add dark mode toggle in settings page"
   - **Component**: Frontend UI (Electron)
   - **Priority**: Medium
3. Submit the issue
4. **Expected behavior:**
   - CodeRabbit creates implementation plan with design considerations
   - Copilot is assigned
   - Timeout: 3 hours (medium complexity)
   - Copilot implements or OpenHands escalates

### Test 3: Manual OpenHands Trigger

1. Create or select an existing issue
2. Add label: `fix-me`
3. **Expected behavior:**
   - OpenHands workflow triggers immediately
   - OpenHands analyzes issue and creates implementation
   - PR created with `Fixes #<issue-number>`

### Test 4: Dual AI Review System

1. Create a PR with a small code change (e.g., add a new function)
2. **Expected behavior:**
   - **CodeRabbit review** appears within 1-2 minutes (style, security, best practices)
   - **OpenHands review** appears within 2-5 minutes (logic, architecture, correctness)
   - Both reviews post separate comments
   - PR labeled with `openhands-reviewed` and `complexity:simple/medium/complex`
   - Summary comment appears: "🤖 Dual AI Review Complete"
3. **Optional:** Add label `auto-fix-review-issues` to trigger automatic fixes

**Manual trigger with focus area:**
```bash
# Security-focused review
gh workflow run openhands-pr-review.yml -f pr_number=123 -f focus_area=security-focus

# Performance-focused review
gh workflow run openhands-pr-review.yml -f pr_number=123 -f focus_area=performance-focus
```

**Skip OpenHands review (for simple PRs):**
Add label `skip-ai-review` to PR

### Monitoring

**View workflow runs:**
```bash
# List recent workflow runs
gh run list --limit 10

# View specific workflow
gh run view <run-id>

# Watch workflow in real-time
gh run watch <run-id>
```

**Check issue status:**
- Issues should have labels: `auto-implement`, `needs-plan`, `copilot-assigned`, etc.
- CodeRabbit comments should appear within 1-2 minutes
- Copilot assignment should happen within 5 minutes of plan completion

---

## Workflow Reference

### Master Automation Controller

**File:** `.github/workflows/master-automation-controller.yml`

**Runs:** Every 30 minutes

**Jobs:**
1. **process-issues** - Processes open issues without plans or assignments
2. **process-prs** - Checks stale PRs, auto-merges ready PRs
3. **force-assign-copilot** - Force-assigns Copilot to planned issues (manual trigger)
4. **force-escalate-openhands** - Force-escalates stale issues to OpenHands (manual trigger)
5. **force-merge-prs** - Force-merges ready PRs (manual trigger)

### Unified AI Automation

**File:** `.github/workflows/unified-ai-automation.yml`

**Trigger:** Issue comments (when CodeRabbit posts plan)

**Purpose:** Detects when CodeRabbit finishes creating a plan and auto-assigns Copilot

**Detection logic:**
```javascript
const planIndicators = [
  '## Implementation',
  '## Coding Plan',
  '### Phase 1',
  'Prompt for AI'
];
const hasPlan = planIndicators.some(i => comment.includes(i));
const planReady = hasPlan && !comment.includes('Planning is in progress') && comment.length > 500;
```

### Copilot Reprompt Stale

**File:** `.github/workflows/copilot-reprompt-stale.yml`

**Runs:** Every 15 minutes

**Purpose:** Re-pings Copilot if no PR created, escalates to OpenHands after 3 re-pings

**Adaptive timeouts:**
- Simple: 1.5 hours before first re-ping
- Medium: 3 hours before first re-ping
- Complex: 6 hours before first re-ping

### Issue Status Checker

**File:** `.github/workflows/issue-status-checker.yml`

**Runs:** Every 15 minutes

**Jobs:**
1. **analyze-issues** - Categorizes all open issues
2. **process-unplanned** - Requests CodeRabbit plans for issues without plans
3. **assign-copilot** - Assigns Copilot to issues with plans
4. **escalate-stale** - Escalates stale Copilot assignments to OpenHands

### OpenHands PR Review

**File:** `.github/workflows/openhands-pr-review.yml`

**Trigger:** PR opened, synchronized, or reopened

**Purpose:** Provides deep code analysis and architectural review to complement CodeRabbit's fast review

**Review Depth by Complexity:**
- **Simple PRs (≤2 files, ≤50 lines):** Quick review focusing on correctness and obvious issues
- **Medium PRs:** Standard review covering correctness, bugs, quality, security, and tests
- **Complex PRs (≥10 files or ≥500 lines):** Comprehensive deep review including:
  1. Correctness and logic
  2. Architecture and design patterns
  3. Security vulnerabilities
  4. Performance implications
  5. Test coverage
  6. Edge cases and error handling

**Focus Areas (Manual Trigger):**
Users can manually trigger reviews with specific focus:
- `security-focus` - Security vulnerabilities, auth, validation, data protection
- `architecture-focus` - Design patterns, code organization, maintainability
- `performance-focus` - Algorithmic complexity, database queries, optimization
- `test-coverage` - Test quality, edge cases, adequacy of test coverage
- `full-review` - Comprehensive review (default)

**Auto-Fix Integration:**
Add label `auto-fix-review-issues` to trigger OpenHands to automatically fix issues found in the review.

**Skip Review:**
Add label `skip-ai-review` to skip OpenHands review for specific PRs (e.g., documentation-only changes).

---

## Troubleshooting

### Issue: CodeRabbit not creating plans

**Symptoms:**
- Issues labeled `auto-implement` but no CodeRabbit comment

**Solutions:**
1. Check CodeRabbit is installed: https://github.com/apps/coderabbitai
2. Verify `.coderabbit.yaml` has `issues.auto_plan: true`
3. Manually trigger by commenting: `@coderabbitai Please create a detailed implementation plan`

### Issue: Copilot not being assigned

**Symptoms:**
- CodeRabbit plan exists but no Copilot assignment

**Solutions:**
1. Check `PAT_TOKEN` secret is set correctly
2. Verify PAT has `repo` permissions
3. Check workflow logs for assignment errors:
   ```bash
   gh run list --workflow=unified-ai-automation.yml --limit 5
   gh run view <run-id>
   ```
4. Manually assign Copilot via issue comment

### Issue: OpenHands not responding

**Symptoms:**
- Issue labeled `fix-me` or `escalated-to-openhands` but no OpenHands activity

**Solutions:**
1. Check OpenHands app is installed
2. Verify `OPENROUTER_API_KEY` secret is set
3. Check OpenHands has necessary permissions
4. View workflow logs:
   ```bash
   gh run list --workflow=openhands-fix-issues.yml --limit 5
   ```

### Issue: Workflows not running

**Symptoms:**
- No workflow runs appearing in Actions tab

**Solutions:**
1. Check Actions are enabled: Settings → Actions → Allow all actions
2. Verify workflow permissions: Settings → Actions → Workflow permissions → Read and write
3. Check workflow syntax:
   ```bash
   # Validate YAML syntax
   yamllint .github/workflows/*.yml
   ```

### Issue: Auto-merge not working

**Symptoms:**
- PR has all checks passing but not auto-merging

**Solutions:**
1. Verify branch protection rules allow auto-merge
2. Check PR has `auto-merge` label
3. Ensure all required status checks pass
4. Check workflow logs:
   ```bash
   gh run list --workflow=master-automation-controller.yml --limit 5
   ```

### Issue: OpenHands PR Review not running

**Symptoms:**
- PR created but no OpenHands review comment appears

**Solutions:**
1. Check if PR is from a bot (bot PRs are skipped to avoid review loops)
2. Verify PR doesn't have `skip-ai-review` label
3. Check workflow logs:
   ```bash
   gh run list --workflow=openhands-pr-review.yml --limit 5
   gh run view <run-id>
   ```
4. Manually trigger review:
   ```bash
   gh workflow run openhands-pr-review.yml -f pr_number=123 -f focus_area=full-review
   ```

### Issue: Dual reviews causing confusion

**Symptoms:**
- Different recommendations from CodeRabbit vs OpenHands

**Solutions:**
1. **CodeRabbit focuses on:** Style, formatting, security patterns, best practices
2. **OpenHands focuses on:** Logic correctness, architecture, edge cases
3. Both reviews are valuable - address issues from both
4. If reviews conflict, prefer the more specific/detailed recommendation
5. You can skip OpenHands review for simple PRs by adding `skip-ai-review` label

### Debug Mode

Enable detailed logging:

1. Add repository secrets:
   - `ACTIONS_STEP_DEBUG=true`
   - `ACTIONS_RUNNER_DEBUG=true`

2. Re-run workflow to see detailed logs

---

## Cost Optimization

### Model Selection

Auto-Claude automation uses cost-optimized models:

| Model | Cost (per 1M tokens) | Use Case |
|-------|---------------------|----------|
| **DeepSeek R1** | $0.30 input / $1.20 output | OpenHands escalations (complex reasoning) |
| **DeepSeek Chat** | $0.14 input / $0.28 output | Simple fixes and refactors |
| **Claude Sonnet 4** | $3.00 input / $15.00 output | Premium quality (if needed) |

**Estimated monthly costs** (assumes 50 issues/PRs per month):

- **Mostly simple issues:** ~$5-10/month (using DeepSeek)
- **Mix of simple/complex:** ~$15-30/month
- **Heavy usage with Claude:** ~$50-100/month

### Cost Reduction Tips

1. **Use CodeRabbit plans** - Free tier available, reduces AI implementation costs
2. **Prefer Copilot for simple tasks** - Included with GitHub Copilot subscription
3. **Use DeepSeek for escalations** - 10-50x cheaper than GPT-4/Claude
4. **Batch similar issues** - Reduces redundant API calls
5. **Set appropriate timeouts** - Prevents unnecessary escalations

### Switching Models

To use a different model in OpenHands workflow:

```yaml
# .github/workflows/openhands-fix-issues.yml
with:
  LLM_MODEL: 'openrouter/deepseek/deepseek-r1'  # Current (cheap)
  # LLM_MODEL: 'anthropic/claude-sonnet-4-20250514'  # Premium (expensive)
  # LLM_MODEL: 'openrouter/deepseek/deepseek-chat'  # Cheapest
```

---

## Next Steps

1. **Test the automation** with the test cases above
2. **Monitor workflow runs** for the first few issues
3. **Adjust timeouts** if Copilot consistently needs more/less time
4. **Customize CodeRabbit** review rules in `.coderabbit.yaml`
5. **Set up notifications** for failed workflows
6. **Review costs** monthly via OpenRouter dashboard

---

## Support

For issues with:

- **CodeRabbit:** https://docs.coderabbit.ai/
- **OpenHands:** https://docs.all-hands.dev/
- **GitHub Actions:** https://docs.github.com/en/actions
- **Auto-Claude:** Open an issue in this repository

---

*Last Updated: 2026-01-01*
