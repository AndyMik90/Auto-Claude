# End-to-End Test Plan: Bidirectional Git Sync

**Test ID:** subtask-5-1
**Feature:** Git Integration - Bidirectional Sync
**Date:** 2026-01-25
**Status:** Ready for Execution

## Overview

This test plan verifies the complete bidirectional synchronization flow between the FHIR Mapper application and Git repositories (GitHub, GitLab, Azure DevOps).

## Prerequisites

### Environment Setup
- [ ] Docker services running (PostgreSQL, Redis, Azurite)
- [ ] Backend service running on http://localhost:8080
- [ ] Frontend service running on http://localhost:3000
- [ ] Test Git repository available (GitHub recommended)
- [ ] Git personal access token with repo permissions

### Test Data
- [ ] Test tenant created/available
- [ ] At least one test template available for sync
- [ ] Git repository initialized with main/master branch

## Test Scenarios

### Scenario 1: Configure Git Repository

**Objective:** Verify that users can configure Git repository connection in the UI

**Steps:**
1. Navigate to http://localhost:3000/admin/settings?tab=git
2. Fill in Git configuration form:
   - Provider: GitHub (or GitLab/Azure DevOps)
   - Repository URL: `https://github.com/{owner}/{repo}`
   - Branch: `main`
   - Personal Access Token: `{your-token}`
3. Click "Test Connection" button
4. Click "Save Configuration" button

**Expected Results:**
- [ ] Connection test shows success message
- [ ] Configuration saves without errors
- [ ] Success toast notification appears
- [ ] No console errors in browser DevTools

**API Verification:**
```bash
# Check configuration was saved
curl -X GET http://localhost:8080/api/v1/settings/git \
  -H "X-Tenant-Id: {tenant-id}" \
  -H "Authorization: Bearer {token}"
```

---

### Scenario 2: Push Templates to Git (Existing Feature)

**Objective:** Verify existing push functionality works correctly

**Steps:**
1. In Git Settings UI, locate "Sync to Git" section
2. Click "Push to Git" or "Sync Now" button
3. Wait for sync operation to complete
4. Check sync history for success status

**Expected Results:**
- [ ] Push operation completes successfully
- [ ] Sync history shows "SUCCESS" status
- [ ] Templates appear in Git repository
- [ ] Files are in correct directory structure

**Git Repository Verification:**
```bash
# Clone repository and verify files exist
git clone https://github.com/{owner}/{repo}.git /tmp/test-repo
cd /tmp/test-repo
ls -la
# Should see template files (e.g., *.json, *.liquid)
```

**API Verification:**
```bash
# Check sync history
curl -X GET http://localhost:8080/api/v1/settings/git/history \
  -H "X-Tenant-Id: {tenant-id}" \
  -H "Authorization: Bearer {token}"
```

---

### Scenario 3: Modify File in Git Repository

**Objective:** Create a change in Git that will be imported back to the application

**Steps:**
1. Navigate to Git repository web interface (GitHub.com)
2. Locate a template file (e.g., `templates/patient-template.json`)
3. Click "Edit" button
4. Make a visible change (e.g., add a comment, modify a field)
5. Commit the change with message: "Test: Manual edit for import verification"
6. Note the commit SHA for verification

**Expected Results:**
- [ ] File edited successfully in Git
- [ ] Commit appears in repository history
- [ ] Commit SHA available for tracking

**Manual Verification:**
```bash
cd /tmp/test-repo
git pull origin main
git log --oneline -1
# Note the commit SHA and message
cat templates/patient-template.json
# Verify your changes are present
```

---

### Scenario 4: Import from Git via UI

**Objective:** Verify that templates can be imported from Git repository back to application

**Steps:**
1. Navigate to http://localhost:3000/admin/settings?tab=git
2. Locate "Import from Git" section
3. Enter branch name: `main`
4. Click "Import from Git" button
5. Wait for import operation to complete
6. Check for success notification

**Expected Results:**
- [ ] Import button shows loading state
- [ ] Import completes without errors
- [ ] Success notification appears
- [ ] No conflicts detected (or conflict modal appears if changes conflict)
- [ ] Import history shows new entry

**API Verification:**
```bash
# Trigger import via API
IMPORT_ID=$(curl -X POST http://localhost:8080/api/v1/settings/git/import \
  -H "X-Tenant-Id: {tenant-id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"branchName":"main"}' | jq -r '.importId')

echo "Import ID: $IMPORT_ID"

# Check import status
curl -X GET "http://localhost:8080/api/v1/settings/git/import/$IMPORT_ID" \
  -H "X-Tenant-Id: {tenant-id}" \
  -H "Authorization: Bearer {token}"
```

---

### Scenario 5: Verify Template Updated in Blob Storage

**Objective:** Confirm that imported changes are persisted in Azure Blob Storage

**Steps:**
1. Navigate to template management UI
2. Open the template that was modified in Git
3. Verify that changes from Git are present
4. Check template metadata (last modified date, etc.)

**Expected Results:**
- [ ] Template shows Git changes
- [ ] Template content matches Git version
- [ ] Last modified timestamp updated
- [ ] No data corruption or loss

**Database Verification:**
```sql
-- Check template metadata
SELECT id, name, version, last_modified, blob_path
FROM templates
WHERE name = 'patient-template'
ORDER BY last_modified DESC
LIMIT 1;

-- Check sync history
SELECT id, sync_type, status, files_synced, created_at, commit_sha
FROM git_sync_history
WHERE sync_type = 'MANUAL'
ORDER BY created_at DESC
LIMIT 1;
```

**Blob Storage Verification:**
```bash
# Using Azure CLI or Storage Explorer
az storage blob download \
  --account-name {storage-account} \
  --container-name templates \
  --name {blob-path} \
  --file /tmp/downloaded-template.json

# Verify content matches Git version
diff /tmp/downloaded-template.json /tmp/test-repo/templates/patient-template.json
```

---

### Scenario 6: Check Import History Shows Success

**Objective:** Verify that import operations are properly logged and visible in UI

**Steps:**
1. In Git Settings UI, locate "Sync History" section
2. Find the most recent import entry
3. Verify entry details:
   - Sync Type: "MANUAL" or "IMPORT"
   - Status: "SUCCESS"
   - Files Synced count
   - Timestamp
   - Commit SHA (if available)

**Expected Results:**
- [ ] Import entry visible in sync history
- [ ] Status shows "SUCCESS"
- [ ] Files synced count is accurate
- [ ] Timestamp is correct
- [ ] Commit SHA matches Git commit (if displayed)

**API Verification:**
```bash
# Get sync history
curl -X GET http://localhost:8080/api/v1/settings/git/history?limit=5 \
  -H "X-Tenant-Id: {tenant-id}" \
  -H "Authorization: Bearer {token}" \
  | jq '.[] | select(.syncType == "MANUAL")'
```

---

## Test Data Capture

### Backend Logs
```bash
# Monitor backend logs during test
tail -f backend.log | grep -i "import\|git"
```

### Frontend Console
- Open browser DevTools (F12)
- Monitor Console tab for errors/warnings
- Monitor Network tab for API calls

### Database State
```sql
-- Before and after snapshots
SELECT COUNT(*) FROM templates;
SELECT COUNT(*) FROM git_sync_history;
SELECT * FROM tenant_git_config WHERE tenant_id = '{tenant-id}';
```

---

## Success Criteria

✅ **All scenarios pass without errors**
✅ **Template content matches between Git and blob storage**
✅ **Import history accurately reflects operations**
✅ **No data loss or corruption**
✅ **No console errors or warnings**
✅ **Backend logs show successful operations**
✅ **Database state is consistent**

---

## Failure Handling

If any scenario fails:

1. **Capture Error Details**
   - Screenshot of error message
   - Browser console logs
   - Backend logs (last 100 lines)
   - Network request/response

2. **Document Failure**
   - Scenario number and step
   - Expected vs actual result
   - Error messages
   - Reproducibility

3. **Debug Steps**
   - Check backend logs: `tail -100 backend.log`
   - Check database state
   - Verify Git repository state
   - Check API responses in Network tab

4. **Fix and Retest**
   - Fix the identified issue
   - Rerun failed scenario
   - Verify fix doesn't break other scenarios

---

## Test Execution Checklist

- [ ] Environment setup completed
- [ ] Test data prepared
- [ ] Scenario 1: Git configuration - PASS/FAIL
- [ ] Scenario 2: Push to Git - PASS/FAIL
- [ ] Scenario 3: Modify in Git - PASS/FAIL
- [ ] Scenario 4: Import from Git - PASS/FAIL
- [ ] Scenario 5: Verify blob storage - PASS/FAIL
- [ ] Scenario 6: Check import history - PASS/FAIL
- [ ] All success criteria met
- [ ] Test report generated

---

## Notes

- This test focuses on the "happy path" (no conflicts)
- Conflict detection is tested separately in subtask-5-3
- Webhook testing is covered in subtask-5-2
- Test with GitHub first, then repeat with GitLab/Azure DevOps if needed

---

## Test Report Template

After execution, complete the test report in `e2e-test-report.md`
