# GitHub Secrets Configuration - Quick Reference

Quick guide for configuring repository secrets required by Auto-Claude automation workflows.

---

## Required Secrets

Navigate to: **Settings → Secrets and variables → Actions → New repository secret**

### 1. OPENROUTER_API_KEY

**Purpose:** Powers OpenHands AI agent for issue/PR fixes using DeepSeek R1 model

**How to get:**
1. Sign up at https://openrouter.ai/
2. Go to https://openrouter.ai/keys
3. Click "Create Key"
4. Copy the key (starts with `sk-or-v1-...`)

**Cost:** ~$0.30 per 1M input tokens (10-50x cheaper than GPT-4/Claude)

**Add to GitHub:**
```
Name: OPENROUTER_API_KEY
Value: sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 2. PAT_TOKEN

**Purpose:** GitHub Personal Access Token for Copilot assignment and workflow automation

**How to get:**

#### Option A: Fine-Grained Token (Recommended)
1. Go to https://github.com/settings/tokens?type=beta
2. Click "Generate new token"
3. Settings:
   - **Token name:** `Auto-Claude Automation`
   - **Expiration:** 90 days (or custom)
   - **Repository access:** Only select repositories → Select `Auto-Claude`
   - **Permissions:**
     - Repository permissions:
       - Contents: Read and write
       - Issues: Read and write
       - Pull requests: Read and write
       - Workflows: Read and write
4. Click "Generate token"
5. Copy the token immediately (starts with `github_pat_...`)

#### Option B: Classic Token (Alternative)
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Scopes required:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
4. Click "Generate token"
5. Copy the token (starts with `ghp_...`)

**Add to GitHub:**
```
Name: PAT_TOKEN
Value: github_pat_xxxxxxxxxxxxxxxxxx  (or ghp_xxxxxxxxx for classic)
```

**⚠️ Important:**
- Store the token securely - you won't be able to see it again
- Set expiration reminder in your calendar
- Rotate token before expiration

---

### 3. PAT_USERNAME

**Purpose:** Your GitHub username for workflow automation

**How to get:**
- This is simply your GitHub username (visible in your profile URL)
- Example: `joelfuller2016`

**Add to GitHub:**
```
Name: PAT_USERNAME
Value: your-github-username
```

---

## Optional Secrets

### COPILOT_PAT (Optional)

**Purpose:** Separate token specifically for Copilot assignment (if you want to use a different token)

**How to get:** Same process as PAT_TOKEN above

**When to use:**
- If you want separate tokens for different automation tasks
- If you want different expiration dates
- If you want to track usage separately

**Add to GitHub:**
```
Name: COPILOT_PAT
Value: github_pat_xxxxxxxxxxxxxxxxxx
```

**Note:** If not set, workflows will fallback to `PAT_TOKEN`

---

### LINEAR_API_KEY (Optional)

**Purpose:** Integrate Auto-Claude with Linear project management

**How to get:**
1. Go to Linear settings: https://linear.app/settings/api
2. Create a new Personal API key
3. Copy the key

**Add to GitHub:**
```
Name: LINEAR_API_KEY
Value: lin_api_xxxxxxxxxxxxxxxxxx
```

---

### Debug Secrets (Optional)

**Purpose:** Enable detailed logging in workflow runs for troubleshooting

**ACTIONS_STEP_DEBUG:**
```
Name: ACTIONS_STEP_DEBUG
Value: true
```

**ACTIONS_RUNNER_DEBUG:**
```
Name: ACTIONS_RUNNER_DEBUG
Value: true
```

**When to use:**
- Troubleshooting workflow failures
- Understanding workflow execution flow
- Debugging API calls and responses

**⚠️ Warning:** Debug mode generates large logs - disable after troubleshooting

---

## Verification Checklist

After adding secrets, verify:

- [ ] **OPENROUTER_API_KEY** is set (check no leading/trailing spaces)
- [ ] **PAT_TOKEN** is set and has correct permissions
- [ ] **PAT_USERNAME** matches your GitHub username exactly
- [ ] All secrets are masked (show as `***` in logs)
- [ ] Test workflow can access secrets:
  ```bash
  gh run list --limit 5
  gh run view <run-id>
  # Check for "secret not found" errors
  ```

---

## Testing Secrets

**Test OPENROUTER_API_KEY:**
1. Create an issue and label it `fix-me`
2. OpenHands workflow should trigger
3. Check workflow logs for API calls to OpenRouter

**Test PAT_TOKEN:**
1. Create an issue using Feature Request template
2. After CodeRabbit creates plan, check if Copilot is assigned
3. Workflow logs should show successful assignment

**Quick test command:**
```bash
# Manually trigger workflow to test secrets
gh workflow run master-automation-controller.yml

# Check the run
gh run list --limit 1
gh run view <run-id>
```

---

## Troubleshooting

### Error: "Secret not found"
**Solution:** Double-check secret name spelling (case-sensitive!)

### Error: "Bad credentials"
**Solution:**
- Verify PAT_TOKEN hasn't expired
- Regenerate token with correct permissions
- Update secret value in GitHub

### Error: "Resource not accessible by integration"
**Solution:**
- PAT_TOKEN needs `repo` and `workflow` scopes
- If using fine-grained token, verify repository access

### Error: "API rate limit exceeded"
**Solution:**
- Check if PAT_TOKEN is a valid Personal Access Token (not a GitHub App token)
- GitHub App tokens have lower rate limits

### Copilot not being assigned
**Solution:**
- Verify `PAT_TOKEN` has `repo` permissions
- Check that `PAT_USERNAME` is correct
- Try regenerating PAT_TOKEN with classic token instead of fine-grained

---

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Rotate tokens regularly** (every 90 days recommended)
3. **Use fine-grained tokens** when possible (more secure)
4. **Limit token scope** to only what's needed
5. **Set expiration dates** on all tokens
6. **Revoke old tokens** after creating new ones
7. **Monitor token usage** in GitHub audit log

---

## Token Rotation Process

When tokens are about to expire:

1. **Create new token** with same permissions
2. **Update secret** in GitHub repository settings
3. **Test workflows** with new token
4. **Revoke old token** once confirmed working
5. **Update calendar** reminder for next rotation

---

## Cost Monitoring

**OpenRouter Dashboard:**
- View usage: https://openrouter.ai/usage
- Track costs per model
- Set usage alerts

**GitHub Actions:**
- View Actions usage: Settings → Billing → Actions
- Free tier: 2,000 minutes/month for public repos
- Auto-Claude automation typically uses <100 minutes/month

---

## Quick Setup Command

```bash
# Set secrets via gh CLI (requires gh CLI installed)
gh secret set OPENROUTER_API_KEY
# Paste your key when prompted

gh secret set PAT_TOKEN
# Paste your PAT when prompted

gh secret set PAT_USERNAME
# Paste your username when prompted
```

---

## Next Steps

After configuring secrets:

1. ✅ Verify all secrets are set
2. ✅ Test automation with a simple issue
3. ✅ Monitor first few workflow runs
4. ✅ Set calendar reminder for token rotation
5. ✅ Review [AUTOMATION_SETUP.md](AUTOMATION_SETUP.md) for full documentation

---

*Last Updated: 2026-01-01*
