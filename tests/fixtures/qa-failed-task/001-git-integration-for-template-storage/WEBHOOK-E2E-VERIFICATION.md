# Webhook End-to-End Verification Guide

## Overview
This document provides comprehensive instructions for verifying the webhook integration functionality of the Git Template Storage feature.

## Prerequisites
- Backend service running on http://localhost:8080
- Frontend service running on http://localhost:3000
- Test Git repository (GitHub, GitLab, or Azure DevOps)
- Webhook relay tool (ngrok, localtunnel, or Cloudflare Tunnel) for local testing
- Valid tenant with Git configuration

## Verification Steps

### Step 1: Enable Webhooks in UI

1. **Navigate to Git Settings**
   ```
   URL: http://localhost:3000/admin/settings?tab=git
   ```

2. **Locate Webhook Configuration Section**
   - Should be visible after "Import from Git" section
   - Shows webhook URL and current status

3. **Enable Webhooks**
   - Toggle the "Enable Webhooks" switch to ON
   - System should generate a webhook secret automatically
   - Webhook URL should be displayed: `https://your-domain.com/api/v1/webhooks/git/{tenantId}`

4. **Copy Webhook Credentials**
   - Copy the webhook URL using the copy button
   - Copy the webhook secret (masked display)
   - Save these for Git provider configuration

**Expected Results:**
- ✅ Webhook section renders without errors
- ✅ Toggle switch is functional
- ✅ Webhook URL is generated and displayed
- ✅ Webhook secret is generated and masked
- ✅ Copy buttons work for both URL and secret
- ✅ Backend API call succeeds (check Network tab)

### Step 2: Configure Webhook in Git Repository

#### For GitHub:

1. **Access Repository Settings**
   - Go to repository on GitHub
   - Click "Settings" > "Webhooks" > "Add webhook"

2. **Configure Webhook**
   - **Payload URL**: Paste the webhook URL from Step 1
   - **Content type**: `application/json`
   - **Secret**: Paste the webhook secret from Step 1
   - **SSL verification**: Enable SSL verification
   - **Events**: Select "Just the push event"
   - **Active**: Check the box

3. **Save Webhook**
   - Click "Add webhook"
   - GitHub will send a test ping

**Expected Results:**
- ✅ Webhook created successfully
- ✅ Recent Deliveries shows a ping event (may fail with local URLs)
- ✅ Response status 200 OK (if accessible)

#### For GitLab:

1. **Access Project Settings**
   - Go to project on GitLab
   - Navigate to "Settings" > "Webhooks"

2. **Configure Webhook**
   - **URL**: Paste the webhook URL from Step 1
   - **Secret Token**: Paste the webhook secret from Step 1
   - **Trigger**: Check "Push events"
   - **SSL verification**: Enable SSL verification

3. **Add Webhook**
   - Click "Add webhook"

**Expected Results:**
- ✅ Webhook added successfully
- ✅ Can test webhook with "Test" button

#### For Azure DevOps:

1. **Access Service Hooks**
   - Go to project on Azure DevOps
   - Click "Project Settings" > "Service Hooks"

2. **Create Service Hook**
   - Click "+ Create subscription"
   - Select "Web Hooks"
   - Event: "Code pushed"
   - Configure filters as needed

3. **Configure Action**
   - **URL**: Paste the webhook URL from Step 1
   - **HTTP headers**: Add `X-Azure-Signature` with webhook secret
   - Test the webhook

**Expected Results:**
- ✅ Service hook created successfully
- ✅ Test delivery succeeds

### Step 3: Push Change to Git Repository

1. **Create Test Change**
   ```bash
   # Clone repository (if not already)
   git clone <repository-url>
   cd <repository-name>

   # Create a test template file change
   echo "// Test webhook trigger" >> templates/test-template.json

   # Commit and push
   git add templates/test-template.json
   git commit -m "Test webhook trigger"
   git push origin main
   ```

2. **Verify Git Provider Received Push**
   - Check commit appears in Git provider UI
   - Verify push was to the configured branch

**Expected Results:**
- ✅ Commit pushed successfully
- ✅ Commit visible in Git provider UI
- ✅ Push event triggered on correct branch

### Step 4: Verify Webhook Received by Backend

1. **Check Webhook Delivery in Git Provider**
   - GitHub: Settings > Webhooks > Recent Deliveries
   - GitLab: Settings > Webhooks > Project Hooks (view recent events)
   - Azure DevOps: Service Hooks > View subscription history

2. **Check Backend Logs**
   ```bash
   # View backend logs
   docker logs -f fhirstudio-backend

   # Look for webhook processing logs:
   # - "Received webhook for tenant: {tenantId}"
   # - "Webhook signature verified successfully"
   # - "Triggering import for branch: {branchName}"
   ```

3. **Verify Webhook Database Entry**
   ```sql
   -- Check webhook was logged
   SELECT * FROM git_sync_history
   WHERE tenant_id = '{tenantId}'
   AND sync_type = 'WEBHOOK'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Expected Results:**
- ✅ Git provider shows 200 OK response for webhook delivery
- ✅ Backend logs show webhook received
- ✅ Signature verification passed
- ✅ Git sync history entry created with type WEBHOOK

### Step 5: Verify Import Triggered Automatically

1. **Check Import Status in UI**
   - Navigate to Git Settings page
   - Check "Sync History" section
   - Look for new entry with type "Webhook" or "Automatic Import"

2. **Check Import Status via API**
   ```bash
   # Get latest import status
   curl -X GET "http://localhost:8080/api/v1/settings/git/sync-history" \
     -H "X-Tenant-ID: {tenantId}" \
     -H "Authorization: Bearer {token}"
   ```

3. **Check Backend Import Logs**
   ```bash
   # Look for import processing logs:
   # - "Starting import for tenant: {tenantId}"
   # - "Pulling files from Git repository"
   # - "Processing file: {filename}"
   # - "Import completed: {filesImported} files imported"
   ```

**Expected Results:**
- ✅ Import entry appears in sync history
- ✅ Import status is COMPLETED
- ✅ Backend logs show import processing
- ✅ No errors in import execution

### Step 6: Verify Template Updated in Blob Storage

1. **Check Blob Storage Directly**
   ```bash
   # Using Azure Storage Explorer or CLI
   az storage blob list \
     --account-name {storage-account} \
     --container-name templates \
     --prefix "tenant-{tenantId}/packages/" \
     --output table
   ```

2. **Verify Template Content**
   ```bash
   # Download and check template content
   az storage blob download \
     --account-name {storage-account} \
     --container-name templates \
     --name "tenant-{tenantId}/packages/{packageId}/{versionId}/test-template.json" \
     --file ./downloaded-template.json

   # Verify content matches Git version
   cat ./downloaded-template.json
   ```

3. **Verify in UI**
   - Navigate to Templates page in UI
   - Locate the updated template
   - Open template and verify content
   - Check "Last Modified" timestamp is recent

4. **Verify Database Metadata**
   ```sql
   -- Check template metadata was updated
   SELECT name, updated_at, version, sha256_hash
   FROM fhir_templates
   WHERE tenant_id = '{tenantId}'
   AND name = 'test-template.json'
   ORDER BY updated_at DESC
   LIMIT 1;
   ```

**Expected Results:**
- ✅ Template file exists in blob storage
- ✅ Template content matches Git repository
- ✅ Template SHA256 hash matches
- ✅ Template metadata updated in database
- ✅ UI shows updated template
- ✅ Last modified timestamp is correct

## Complete End-to-End Flow Verification

### Success Criteria Checklist

- [ ] **UI Configuration**
  - [ ] Webhook section renders correctly
  - [ ] Enable/disable toggle works
  - [ ] Webhook URL generated and displayed
  - [ ] Webhook secret generated (masked)
  - [ ] Copy buttons functional

- [ ] **Git Provider Configuration**
  - [ ] Webhook created in Git provider
  - [ ] Webhook URL configured correctly
  - [ ] Webhook secret configured
  - [ ] Push events enabled

- [ ] **Webhook Delivery**
  - [ ] Git push triggers webhook
  - [ ] Webhook delivered to backend
  - [ ] Backend receives webhook payload
  - [ ] Signature verification passes
  - [ ] Webhook logged in database

- [ ] **Automatic Import**
  - [ ] Import triggered automatically
  - [ ] Import executes without errors
  - [ ] Import status tracked correctly
  - [ ] Sync history updated

- [ ] **Blob Storage Update**
  - [ ] Template files synced to blob storage
  - [ ] File content matches Git
  - [ ] SHA256 hashes match
  - [ ] Database metadata updated
  - [ ] UI reflects changes

## Testing with Local Development

### Using ngrok for Local Testing

```bash
# Start ngrok tunnel
ngrok http 8080

# Example output:
# Forwarding https://abc123.ngrok.io -> http://localhost:8080

# Use the ngrok URL as your webhook URL:
# https://abc123.ngrok.io/api/v1/webhooks/git/{tenantId}
```

### Using localtunnel

```bash
# Install localtunnel
npm install -g localtunnel

# Start tunnel
lt --port 8080

# Example output:
# your url is: https://smooth-jellyfish-12.loca.lt

# Use the localtunnel URL as your webhook URL
```

## Troubleshooting

### Webhook Not Received

1. **Check Network Connectivity**
   - Ensure webhook URL is accessible from internet
   - Test URL with curl: `curl -X POST https://your-domain.com/api/v1/webhooks/git/{tenantId}`

2. **Check Backend Logs**
   - Look for errors in webhook processing
   - Verify endpoint is registered: `Mapped "{[/api/v1/webhooks/git/{tenantId}],methods=[POST]}"`

3. **Check Git Provider Webhook Status**
   - View recent deliveries in Git provider UI
   - Check response status codes
   - Review error messages

### Signature Verification Failed

1. **Verify Webhook Secret**
   - Ensure secret matches between UI and Git provider
   - Check secret is not truncated or modified
   - Regenerate secret if needed

2. **Check Signature Header**
   - GitHub: `X-Hub-Signature-256` header present
   - GitLab: `X-Gitlab-Token` header present
   - Azure DevOps: Signature header or body authentication

3. **Review Backend Logs**
   - Look for signature verification errors
   - Check which provider verification method was used

### Import Not Triggered

1. **Check Webhook Processing**
   - Verify webhook was received (Step 4)
   - Check GitWebhookService.shouldTriggerImport() logic
   - Verify event type matches (push event)

2. **Check Branch Configuration**
   - Ensure push was to a monitored branch
   - Verify branch name extraction worked
   - Check branch exists in Git config

3. **Check Import Service Logs**
   - Look for import queueing errors
   - Verify GitImportService is running
   - Check async executor status

### Blob Storage Not Updated

1. **Check Import Completion**
   - Verify import completed successfully
   - Check for import errors in logs
   - Review sync history status

2. **Check Blob Storage Connection**
   - Verify Azure Blob Storage credentials
   - Test blob storage connectivity
   - Check container permissions

3. **Check File Paths**
   - Verify template path matches expected pattern
   - Check package ID and version ID extraction
   - Verify blob naming convention

## Security Considerations

### Webhook Security Best Practices

1. **Signature Verification**
   - Always verify webhook signatures
   - Use constant-time comparison
   - Log all signature failures

2. **Secret Management**
   - Store webhook secrets encrypted
   - Never expose secrets in logs
   - Rotate secrets periodically

3. **Rate Limiting**
   - Implement rate limiting on webhook endpoint
   - Protect against DoS attacks
   - Monitor for abuse

4. **Audit Logging**
   - Log all webhook deliveries
   - Track import triggers
   - Monitor for suspicious activity

## Performance Monitoring

### Key Metrics to Track

1. **Webhook Processing Time**
   - Time to receive and verify webhook
   - Time to trigger import
   - Total end-to-end latency

2. **Import Performance**
   - Number of files imported
   - Time to complete import
   - Success/failure rate

3. **Resource Usage**
   - Backend CPU/memory during import
   - Blob storage API calls
   - Database query performance

## Automated Testing Script

See `webhook-e2e-test.sh` for an automated test script that performs all verification steps.

## Success Summary

When all verification steps pass, the webhook integration is working correctly:

✅ **Complete End-to-End Flow Working:**
1. User enables webhooks in UI ✓
2. Webhook configured in Git provider ✓
3. Git push triggers webhook delivery ✓
4. Backend receives and verifies webhook ✓
5. Import triggered automatically ✓
6. Templates synced to blob storage ✓

The system now supports automatic template updates when Git repositories change!
