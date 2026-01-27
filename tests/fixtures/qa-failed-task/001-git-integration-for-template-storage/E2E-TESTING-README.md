# End-to-End Testing Guide

This directory contains comprehensive end-to-end testing documentation and scripts for the Git Integration Bidirectional Sync feature.

## Quick Start

### 1. Prerequisites

Ensure you have:
- Docker Desktop running
- Java 17+ and Maven installed
- Node.js 18+ and npm installed
- A test Git repository (GitHub, GitLab, or Azure DevOps)
- Personal Access Token for Git repository

### 2. Start Services

```bash
# From the project root directory
cd .auto-claude/specs/001-git-integration-for-template-storage
./init.sh
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Backend API (port 8080)
- Frontend UI (port 3000)
- Supporting services (FHIR Converter, Validator)

Wait for all services to be ready (script will confirm when ready).

### 3. Configure Test Environment

Export required environment variables:

```bash
# Required
export TENANT_ID="your-tenant-id"
export AUTH_TOKEN="your-auth-token"

# Optional (for automated script)
export GIT_REPO_URL="https://github.com/owner/repo"
export GIT_TOKEN="your-git-token"
export GIT_BRANCH="main"
```

### 4. Run Automated Tests

```bash
./e2e-test-script.sh
```

This will:
- Verify services are running
- Check Git configuration
- Trigger import operation
- Poll for import completion
- Verify sync history

### 5. Complete Manual Verification

Follow the detailed test plan:

```bash
cat e2e-test-plan.md
```

Navigate through each scenario and verify results.

### 6. Generate Test Report

Copy the template and fill in results:

```bash
cp e2e-test-report.md e2e-test-report-$(date +%Y%m%d).md
# Edit the report with your test results
```

---

## Test Files Overview

| File | Purpose |
|------|---------|
| `e2e-test-plan.md` | Comprehensive test scenarios and steps |
| `e2e-test-script.sh` | Automated test execution script |
| `e2e-test-report.md` | Template for documenting test results |
| `E2E-TESTING-README.md` | This file - testing guide |
| `init.sh` | Service startup script |

---

## Detailed Test Scenarios

### Scenario 1: Configure Git Repository

**Purpose:** Verify Git configuration UI and connection testing

**Steps:**
1. Navigate to http://localhost:3000/admin/settings?tab=git
2. Fill in repository details
3. Test connection
4. Save configuration

**Success Criteria:**
- Connection test passes
- Configuration saves successfully
- No errors in UI or console

---

### Scenario 2: Push Templates to Git

**Purpose:** Verify existing push functionality (baseline)

**Steps:**
1. Click "Push to Git" button
2. Wait for operation to complete
3. Verify in Git repository

**Success Criteria:**
- Push completes successfully
- Files appear in Git repository
- Sync history shows success

---

### Scenario 3: Modify File in Git

**Purpose:** Create a change to import

**Steps:**
1. Navigate to Git repository web interface
2. Edit a template file
3. Commit the change

**Success Criteria:**
- File modified in Git
- Commit appears in history

---

### Scenario 4: Import from Git

**Purpose:** Verify import functionality (core feature)

**Steps:**
1. Click "Import from Git" button
2. Enter branch name
3. Wait for import to complete

**Success Criteria:**
- Import completes successfully
- No conflicts detected (or conflict modal if changes conflict)
- Import history updated

---

### Scenario 5: Verify Blob Storage Update

**Purpose:** Confirm changes persisted in blob storage

**Steps:**
1. Open template in UI
2. Verify Git changes are present
3. Check metadata updated

**Success Criteria:**
- Template shows Git changes
- Last modified timestamp updated
- No data corruption

---

### Scenario 6: Check Import History

**Purpose:** Verify operation logging

**Steps:**
1. View sync history in UI
2. Find import entry
3. Verify details

**Success Criteria:**
- Import entry visible
- Status is SUCCESS
- Files synced count accurate

---

## API Endpoints Reference

### Git Configuration

```bash
# Get current Git configuration
GET /api/v1/settings/git
Headers:
  X-Tenant-Id: {tenant-id}
  Authorization: Bearer {token}

# Save Git configuration
POST /api/v1/settings/git
Headers:
  X-Tenant-Id: {tenant-id}
  Authorization: Bearer {token}
Body:
  {
    "provider": "GITHUB",
    "repositoryUrl": "https://github.com/owner/repo",
    "branchName": "main",
    "authToken": "ghp_xxxxx"
  }
```

### Git Import

```bash
# Trigger import
POST /api/v1/settings/git/import
Headers:
  X-Tenant-Id: {tenant-id}
  Authorization: Bearer {token}
Body:
  {
    "branchName": "main"
  }

Response:
  {
    "importId": "uuid",
    "success": true,
    "status": "PENDING"
  }

# Check import status
GET /api/v1/settings/git/import/{importId}
Headers:
  X-Tenant-Id: {tenant-id}
  Authorization: Bearer {token}

Response:
  {
    "importId": "uuid",
    "success": true,
    "status": "COMPLETED",
    "filesImported": 5,
    "conflicts": []
  }
```

### Sync History

```bash
# Get sync history
GET /api/v1/settings/git/history?limit=10
Headers:
  X-Tenant-Id: {tenant-id}
  Authorization: Bearer {token}

Response:
  [
    {
      "id": "uuid",
      "syncType": "MANUAL",
      "status": "SUCCESS",
      "filesSynced": 5,
      "commitSha": "abc123",
      "createdAt": "2026-01-25T10:00:00Z"
    }
  ]
```

---

## Troubleshooting

### Services Not Starting

**Problem:** Backend or frontend fails to start

**Solutions:**
1. Check Docker is running: `docker ps`
2. Check logs: `tail -f backend.log` or `tail -f frontend.log`
3. Verify ports are available: `lsof -i :8080` and `lsof -i :3000`
4. Restart infrastructure: `docker-compose restart`

### Import Fails

**Problem:** Import operation fails or times out

**Solutions:**
1. Check backend logs for errors: `tail -100 backend.log | grep -i error`
2. Verify Git configuration is correct
3. Verify Git token has correct permissions
4. Check network connectivity to Git provider
5. Verify branch name is correct

### No Changes Detected

**Problem:** Import completes but template not updated

**Solutions:**
1. Verify file was actually modified in Git
2. Check blob storage connection
3. Verify template path matches Git repository structure
4. Check database sync history for actual files synced
5. Review backend logs for import processing details

### Console Errors

**Problem:** Browser console shows errors

**Solutions:**
1. Check Network tab for failed requests
2. Verify API endpoints are accessible
3. Check for CORS issues
4. Verify authentication token is valid
5. Clear browser cache and reload

---

## Database Verification Queries

### Check Templates

```sql
-- List all templates
SELECT id, name, version, last_modified, blob_path
FROM templates
ORDER BY last_modified DESC
LIMIT 10;

-- Find specific template
SELECT *
FROM templates
WHERE name LIKE '%patient%';
```

### Check Sync History

```sql
-- Recent sync operations
SELECT id, sync_type, status, files_synced, commit_sha, created_at, error_message
FROM git_sync_history
ORDER BY created_at DESC
LIMIT 10;

-- Import operations only
SELECT *
FROM git_sync_history
WHERE sync_type = 'MANUAL'
ORDER BY created_at DESC;
```

### Check Git Configuration

```sql
-- Current Git config
SELECT tenant_id, provider, repository_url, branch_name,
       webhook_enabled, webhook_url, created_at, updated_at
FROM tenant_git_config
WHERE tenant_id = '{your-tenant-id}';
```

---

## Performance Benchmarks

Expected performance for import operations:

| Repository Size | File Count | Expected Duration |
|----------------|------------|-------------------|
| Small | 1-10 files | 2-5 seconds |
| Medium | 11-50 files | 5-15 seconds |
| Large | 51-100 files | 15-30 seconds |
| Extra Large | 100+ files | 30-60 seconds |

*Note: Times may vary based on network speed and Git provider API limits*

---

## Test Data Management

### Creating Test Templates

```bash
# Example: Create a test template file
cat > test-template.json <<EOF
{
  "resourceType": "Patient",
  "id": "test-patient",
  "name": [{
    "family": "Test",
    "given": ["Import"]
  }]
}
EOF
```

### Cleaning Up Test Data

```sql
-- Remove test sync history
DELETE FROM git_sync_history
WHERE commit_sha LIKE '%test%';

-- Remove test templates
DELETE FROM templates
WHERE name LIKE 'test-%';
```

---

## Continuous Integration

To integrate these tests into CI/CD:

```yaml
# Example GitHub Actions workflow
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Start services
        run: ./init.sh
      - name: Run E2E tests
        env:
          TENANT_ID: ${{ secrets.TEST_TENANT_ID }}
          AUTH_TOKEN: ${{ secrets.TEST_AUTH_TOKEN }}
        run: ./e2e-test-script.sh
```

---

## Support and Issues

If you encounter issues during testing:

1. **Check Documentation:** Review `e2e-test-plan.md` for detailed steps
2. **Review Logs:** Check backend.log and frontend.log
3. **Verify Configuration:** Ensure all environment variables are set
4. **Check Database:** Run verification queries
5. **Report Issues:** Document in `e2e-test-report.md`

---

## Next Steps

After completing subtask-5-1:

1. **subtask-5-2:** Webhook end-to-end flow verification
2. **subtask-5-3:** Conflict detection verification

Each has its own test plan and documentation.

---

## Additional Resources

- [Git Integration Spec](./spec.md)
- [Implementation Plan](./implementation_plan.json)
- [Build Progress](./build-progress.txt)
- [Project Index](./project_index.json)
