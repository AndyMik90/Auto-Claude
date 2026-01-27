# Conflict Detection End-to-End Verification Guide

**Feature:** Git Integration - Conflict Detection & Resolution
**Subtask:** subtask-5-3
**Date:** 2026-01-25

## Overview

This document provides a comprehensive guide for verifying the conflict detection and resolution functionality of the Git integration feature. The conflict detection system identifies when files have been modified both locally and in Git, presenting users with resolution options.

## Prerequisites

### 1. Running Services

- Backend service running on `http://localhost:8080`
- Frontend service running on `http://localhost:3000`
- PostgreSQL database accessible
- Azure Blob Storage configured
- Redis cache (if used for async operations)

### 2. Git Repository Setup

- A test Git repository (GitHub, GitLab, or Azure DevOps)
- Repository initialized with at least one template file
- Write access to the repository
- Git configuration completed in the application

### 3. Test Data

- At least one template file to test with (e.g., `patient-template.json`)
- Valid FHIR mapping template content
- Access to edit the file both in UI and Git repository

### 4. User Access

- Valid tenant ID with Git configuration
- User credentials with admin/settings permissions
- Git provider authentication token

## Verification Steps

### Step 1: Modify Template in UI and Save

**Objective:** Create local changes that will conflict with Git changes

**Actions:**

1. Log into the application frontend (`http://localhost:3000`)
2. Navigate to Templates section
3. Select an existing template (e.g., `patient-template.json`)
4. Make modifications to the template content:
   - Change field mappings
   - Update transformation rules
   - Modify template metadata
5. Save the template to blob storage
6. Verify the save was successful

**Expected Results:**

- Template successfully saved to blob storage
- Local SHA hash updated
- No sync operation triggered yet
- Template visible in UI with updated content

**Verification Commands:**

```bash
# Check blob storage for updated file
az storage blob show \
  --account-name <storage-account> \
  --container-name templates \
  --name patient-template.json \
  --query '{lastModified: properties.lastModified, contentLength: properties.contentLength}'

# Check database for template record
psql -h localhost -U fhirmapper -d fhirmapper -c \
  "SELECT id, name, file_path, updated_at FROM template_packages WHERE name LIKE '%patient%';"
```

**Evidence to Collect:**

- Screenshot of modified template in UI
- Blob storage timestamp
- Local content SHA hash
- Database record timestamp

---

### Step 2: Modify Same Template in Git Differently

**Objective:** Create conflicting changes in the Git repository

**Actions:**

1. Open your test Git repository in browser or local clone
2. Navigate to the same template file (`templates/patient-template.json`)
3. Make **different** modifications to the template:
   - Change different fields than you modified locally
   - Add new fields not present in local version
   - Update different transformation rules
4. Commit the changes to Git with descriptive message
5. Push changes to the remote repository (main or feature branch)

**Expected Results:**

- Git commit successful
- Changes visible in Git repository UI
- Git commit SHA hash generated
- File content differs from local blob storage

**Verification Commands:**

```bash
# View latest Git commit
git log -1 --oneline

# View file content in Git
git show HEAD:templates/patient-template.json

# Get commit SHA
git rev-parse HEAD

# Compare with local content (if you have both)
diff <(cat local-patient-template.json) <(git show HEAD:templates/patient-template.json)
```

**Evidence to Collect:**

- Git commit SHA
- Screenshot of Git changes
- Git file content
- Commit message and timestamp

---

### Step 3: Trigger Import

**Objective:** Initiate import operation that will detect conflicts

**Actions:**

1. Navigate to Settings > Git Integration in the UI
2. Verify Git configuration is active
3. Select branch containing the modified template (usually `main`)
4. Click "Import from Git" button
5. Observe import operation status

**Expected Results:**

- Import operation starts (status: PENDING)
- Import ID returned from API
- Import status transitions to IN_PROGRESS
- Backend begins processing import

**API Call:**

```bash
# Trigger import via API
curl -X POST http://localhost:8080/api/v1/settings/git/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "branchName": "main"
  }'

# Expected response:
# {
#   "importId": "550e8400-e29b-41d4-a716-446655440000",
#   "success": true,
#   "status": "PENDING",
#   "message": "Import operation queued successfully"
# }
```

**Verification Commands:**

```bash
# Check import status
curl -X GET http://localhost:8080/api/v1/settings/git/import/{importId} \
  -H "Authorization: Bearer <token>"

# Check sync history in database
psql -h localhost -U fhirmapper -d fhirmapper -c \
  "SELECT id, status, trigger_reason, started_at, files_synced
   FROM git_sync_history
   ORDER BY started_at DESC
   LIMIT 5;"

# Check backend logs
tail -f backend/logs/spring-boot-app.log | grep -i "import\|conflict"
```

**Evidence to Collect:**

- Import ID from response
- Initial import status
- Backend log entries
- UI status indicators

---

### Step 4: Verify Conflict Detected

**Objective:** Confirm the system detects the conflicting changes

**Actions:**

1. Monitor import status via UI or API polling
2. Wait for import operation to complete analysis phase
3. Check import response for conflicts array
4. Verify conflict details include both versions

**Expected Results:**

- Import status shows conflicts detected
- `conflicts` array is non-empty
- Conflict response includes:
  - File path
  - Git content and SHA
  - Local content and SHA
  - Package/version IDs
- Import paused waiting for resolution

**API Response Structure:**

```json
{
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "success": false,
  "filesImported": 0,
  "status": "CONFLICTS_DETECTED",
  "conflicts": [
    {
      "path": "templates/patient-template.json",
      "gitContent": "{ \"resourceType\": \"Patient\", ... }",
      "localContent": "{ \"resourceType\": \"Patient\", ... }",
      "gitSha": "a1b2c3d4e5f6...",
      "localSha": "f6e5d4c3b2a1...",
      "packageId": "pkg-uuid",
      "versionId": "ver-uuid"
    }
  ],
  "message": "Conflicts detected. Please resolve before completing import."
}
```

**Verification Commands:**

```bash
# Poll import status until conflicts detected
while true; do
  curl -s http://localhost:8080/api/v1/settings/git/import/{importId} \
    -H "Authorization: Bearer <token>" | jq '.status, .conflicts'
  sleep 2
done

# Check for conflict detection in logs
grep -i "conflict detected" backend/logs/spring-boot-app.log

# Verify SHA hash differences
echo "Git SHA: {gitSha}"
echo "Local SHA: {localSha}"
```

**Evidence to Collect:**

- Full conflict response JSON
- SHA hashes for both versions
- Screenshots of conflict detection
- Backend log entries showing conflict detection logic

---

### Step 5: Resolve Conflict in UI

**Objective:** User resolves conflicts through the UI

**Actions:**

1. Observe conflict modal appears automatically in UI
2. Review the side-by-side diff view showing:
   - Git version (left/top)
   - Local version (right/bottom)
3. Read both versions carefully
4. Choose resolution strategy:
   - **Use Git Version**: Replace local with Git content
   - **Keep Local Version**: Discard Git changes
   - ~~**Manual Merge**: Combine changes manually~~ (not implemented yet)
5. If multiple conflicts, navigate through all conflicts
6. Select resolution for each conflict
7. Click "Apply Resolutions" button

**Expected Results:**

- Conflict modal displays correctly
- Diff view shows both versions clearly
- SHA badges visible for both versions
- Navigation works between multiple conflicts
- Resolution selection updates state
- "Apply Resolutions" button enabled after all selections
- Resolution request sent to backend

**UI Elements to Verify:**

- Modal header shows conflict count
- File path displayed with code icon
- Git version badge (blue)
- Local version badge (green)
- Resolution buttons with icons and descriptions
- Selected state highlighted
- Cancel button available
- Apply button enabled/disabled correctly

**Evidence to Collect:**

- Screenshot of conflict modal
- Screenshot of diff view
- Selected resolution for each conflict
- Network request payload

---

### Step 6: Verify Resolution Applied Correctly

**Objective:** Confirm resolution successfully applied and import completed

**Actions:**

1. After clicking "Apply Resolutions", monitor import completion
2. Check import status transitions to COMPLETED
3. Verify template content matches chosen resolution:
   - If "Use Git": Content matches Git version
   - If "Keep Local": Content unchanged from local version
4. Check sync history shows successful import
5. Verify no data loss or corruption
6. Confirm template functional in application

**Expected Results:**

- Import status: COMPLETED
- Conflict resolution applied to blob storage
- Template content matches resolution choice
- Sync history updated with success
- No conflicts remain
- File count correct
- Template usable in application

**API Response After Resolution:**

```json
{
  "importId": "550e8400-e29b-41d4-a716-446655440000",
  "success": true,
  "filesImported": 1,
  "status": "COMPLETED",
  "conflicts": [],
  "message": "Import completed successfully with conflict resolutions applied"
}
```

**Verification Commands:**

```bash
# Check final import status
curl -X GET http://localhost:8080/api/v1/settings/git/import/{importId} \
  -H "Authorization: Bearer <token>" | jq '.'

# Verify blob storage content
az storage blob download \
  --account-name <storage-account> \
  --container-name templates \
  --name patient-template.json \
  --file /tmp/resolved-template.json

# Compare with expected content
cat /tmp/resolved-template.json

# Check sync history
psql -h localhost -U fhirmapper -d fhirmapper -c \
  "SELECT id, status, files_synced, completed_at, error_message
   FROM git_sync_history
   WHERE id = '{importId}';"

# Verify template SHA matches expected version
sha256sum /tmp/resolved-template.json
```

**Evidence to Collect:**

- Final import response
- Resolved file content
- SHA hash of resolved content
- Sync history record
- Screenshot of successful import
- Backend logs showing resolution application

---

## Resolution Strategies Testing

### Test Case 1: USE_GIT Resolution

**Scenario:** User chooses to accept Git version

**Expected Outcome:**
- Local blob storage updated with Git content
- Local SHA matches Git SHA
- Previous local changes discarded
- No data corruption

**Verification:**
```bash
# Content should match Git version exactly
diff <(az storage blob download --name patient-template.json --output tsv) \
     <(git show HEAD:templates/patient-template.json)
# Should output: No differences
```

### Test Case 2: USE_LOCAL Resolution

**Scenario:** User chooses to keep local version

**Expected Outcome:**
- Local blob storage unchanged
- Local SHA unchanged
- Git changes ignored
- Import marked as completed with no changes

**Verification:**
```bash
# Local content should be unchanged from Step 1
# SHA should match pre-import SHA
```

### Test Case 3: Multiple Conflicts

**Scenario:** Import detects conflicts in multiple files

**Expected Outcome:**
- All conflicts presented in modal
- User can navigate between conflicts
- Each conflict resolved independently
- All resolutions applied atomically

**Setup:**
```bash
# Modify multiple templates locally
# Modify same templates differently in Git
# Trigger import
# Verify all conflicts detected
```

### Test Case 4: Mixed Resolutions

**Scenario:** Some conflicts resolved with USE_GIT, others with USE_LOCAL

**Expected Outcome:**
- Each resolution applied to correct file
- No cross-contamination
- Atomic transaction (all or nothing)
- Rollback on partial failure

---

## Troubleshooting

### Issue: Conflicts Not Detected

**Symptoms:** Import completes without detecting conflicts

**Possible Causes:**
- SHA comparison not implemented
- Files paths don't match between Git and blob storage
- Import service not comparing content
- Phase 1 pull methods not implemented

**Investigation:**
```bash
# Check if pull methods are implemented
grep -r "pullFiles\|getFileContents" backend/src/main/java/.../git/

# Check import service logic
grep -A 50 "performImport" backend/src/main/java/.../git/GitImportService.java

# Check backend logs for conflict detection
grep -i "conflict\|sha\|hash" backend/logs/spring-boot-app.log
```

---

### Issue: Conflict Modal Not Appearing

**Symptoms:** Conflicts detected but modal doesn't show

**Possible Causes:**
- Frontend not checking for conflicts in response
- Modal component not imported
- React state not updating
- API response format mismatch

**Investigation:**
```bash
# Check browser console for errors
# Verify API response includes conflicts array
# Check GitSettings component imports GitConflictModal
grep -n "GitConflictModal" frontend/src/components/settings/GitSettings.tsx

# Check conflict state handling
grep -A 20 "handleImport" frontend/src/components/settings/GitSettings.tsx
```

---

### Issue: Resolution Not Applied

**Symptoms:** Resolution selected but import doesn't complete

**Possible Causes:**
- Resolve conflicts endpoint not implemented
- API request format incorrect
- Backend not processing resolutions
- Blob storage update failing

**Investigation:**
```bash
# Check if resolve endpoint exists
curl -X POST http://localhost:8080/api/v1/settings/git/import/resolve-conflicts \
  -H "Content-Type: application/json" \
  -d '{"importId": "xxx", "resolutions": []}'

# Check backend logs
tail -f backend/logs/spring-boot-app.log | grep -i "resolve\|resolution"

# Verify API call in network tab
# Check request payload format
```

---

## Success Criteria

### ✅ Conflict Detection

- [ ] Conflicts detected when same file modified locally and in Git
- [ ] SHA hashes calculated correctly for both versions
- [ ] Conflict response includes all required fields
- [ ] Multiple conflicts detected simultaneously
- [ ] Import pauses when conflicts detected

### ✅ UI Presentation

- [ ] Conflict modal appears automatically
- [ ] Side-by-side diff view displays correctly
- [ ] Both versions visible and readable
- [ ] SHA badges shown for both versions
- [ ] Navigation works between multiple conflicts
- [ ] Resolution options clearly labeled

### ✅ Resolution Application

- [ ] USE_GIT resolution replaces local with Git content
- [ ] USE_LOCAL resolution keeps local content unchanged
- [ ] Multiple resolutions applied correctly
- [ ] Mixed resolutions work (some USE_GIT, some USE_LOCAL)
- [ ] Atomic transaction (all resolutions succeed or rollback)

### ✅ Import Completion

- [ ] Import status transitions to COMPLETED after resolution
- [ ] Sync history updated correctly
- [ ] File counts accurate
- [ ] No data corruption
- [ ] Templates functional after resolution

---

## Performance Considerations

### Large File Conflicts

- Test with templates >100KB
- Verify diff view renders performantly
- Check memory usage during conflict resolution
- Monitor blob storage throughput

### Multiple Simultaneous Conflicts

- Test with 10+ conflicting files
- Verify UI remains responsive
- Check async processing handles load
- Monitor database transaction times

### Network Latency

- Test resolution with simulated network delays
- Verify loading states shown correctly
- Check timeout handling
- Test retry logic

---

## Security Considerations

### Access Control

- [ ] Only authorized users can trigger imports
- [ ] Conflict resolutions validated against user permissions
- [ ] Tenant isolation enforced
- [ ] Audit trail for conflict resolutions

### Data Integrity

- [ ] SHA hashes validated before and after resolution
- [ ] No data loss during resolution
- [ ] Rollback on partial failure
- [ ] Blob storage consistency maintained

### Git Provider Authentication

- [ ] Tokens not exposed in conflict responses
- [ ] Secure communication with Git providers
- [ ] Token refresh handled correctly
- [ ] Provider-specific auth respected

---

## Automation Script

See `conflict-detection-test.sh` for automated testing script.

---

## Known Limitations

### Phase 1 Implementation Gap

As documented in subtask-5-1 verification:

- Pull methods (pullFiles, getFileContents, listFiles) need to be added to GitProvider interface
- GitImportService currently contains placeholder implementation
- Actual conflict detection logic depends on Phase 1 completion

**Current State:**
- Conflict detection DTOs: ✅ Complete
- Conflict resolution UI: ✅ Complete
- Conflict resolution API: ✅ Complete (endpoints exist)
- Actual conflict detection logic: ⚠️ Placeholder (Phase 1 gap)

**Impact:**
- UI components fully functional when given conflicts
- API endpoints ready to receive and process resolutions
- Actual file comparison and conflict detection needs Phase 1 implementation

---

## Test Report Template

Use this template to document test execution results:

```markdown
# Conflict Detection Test Report

**Date:** [DATE]
**Tester:** [NAME]
**Environment:** [dev/staging/production]

## Test Execution

| Step | Status | Notes |
|------|--------|-------|
| 1. Modify template in UI | ✅/❌ | |
| 2. Modify template in Git | ✅/❌ | |
| 3. Trigger import | ✅/❌ | |
| 4. Verify conflict detected | ✅/❌ | |
| 5. Resolve conflict in UI | ✅/❌ | |
| 6. Verify resolution applied | ✅/❌ | |

## Evidence

- Import ID: [UUID]
- Git SHA: [HASH]
- Local SHA: [HASH]
- Resolution: [USE_GIT/USE_LOCAL]
- Final SHA: [HASH]

## Issues Encountered

[List any issues or blockers]

## Recommendations

[Improvements or concerns]
```

---

## Conclusion

This verification guide provides comprehensive steps to validate the conflict detection and resolution functionality. Follow each step carefully and document results thoroughly. The conflict detection feature is critical for safe bidirectional sync, ensuring no data loss when templates are modified in both locations.
