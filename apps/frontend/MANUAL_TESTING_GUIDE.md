# Manual Testing Guide: GitHub Issues Pagination

## Overview
This guide provides step-by-step instructions for manually testing the GitHub Issues pagination implementation to verify complete issue fetching.

## Prerequisites
- Electron app is running: `cd apps/frontend && npm run dev`
- GitHub token is configured in the app
- Internet connection is active

## Test Scenarios

### Test 1: Repository with >100 Issues (Multiple Pages)

**Objective:** Verify pagination fetches all issues across multiple pages

**Steps:**
1. Open the Auto Claude Electron app
2. Navigate to the GitHub Issues page
3. Enter a repository with >100 issues (e.g., `facebook/react`)
4. Click the "Refresh" button
5. Open the Developer Console (Ctrl+Shift+I or Cmd+Option+I)
6. Observe the console logs
7. Compare the displayed issue count with the GitHub website

**Expected Results:**
- Console shows multiple "Fetching page X..." messages
- Console shows "Fetched 100 issues from page X" for full pages
- Console shows "Fetched <100 issues from page Y" for the last page
- Console shows summary: "Total fetched: X items", "After filtering PRs: Y issues"
- All issues from the repository are displayed (not just first 100)
- Issue count matches GitHub's issue count

**Example Console Output:**
```
Fetching page 1 of issues from facebook/react...
Fetched 100 issues from page 1
Fetching page 2 of issues from facebook/react...
Fetched 100 issues from page 2
Fetching page 3 of issues from facebook/react...
Fetched 100 issues from page 3
...
Fetching page N of issues from facebook/react...
Fetched 42 issues from page N
Total fetched: 5342 items (issues + PRs)
After filtering PRs: 4891 issues
Filtered out 451 pull requests
```

---

### Test 2: Repository with <100 Issues (Single Page)

**Objective:** Verify single API call for small repositories

**Steps:**
1. Navigate to the GitHub Issues page
2. Enter a small repository with <100 issues (e.g., a new/test repository)
3. Click the "Refresh" button
4. Open the Developer Console
5. Observe the console logs

**Expected Results:**
- Console shows only ONE "Fetching page 1..." message
- Console shows "Fetched X issues from page 1" where X < 100
- Console shows summary with correct counts
- All issues are displayed
- Only ONE page was fetched (no unnecessary second call)

**Example Console Output:**
```
Fetching page 1 of issues from owner/small-repo...
Fetched 45 issues from page 1
Total fetched: 45 items (issues + PRs)
After filtering PRs: 42 issues
Filtered out 3 pull requests
```

---

### Test 3: Repository with Exactly 100 Issues

**Objective:** Verify no unnecessary second API call when repo has exactly 100 issues

**Steps:**
1. Find or create a repository with exactly 100 issues
2. Enter the repository in the GitHub Issues page
3. Click the "Refresh" button
4. Open the Developer Console
5. Observe the console logs

**Expected Results:**
- Console shows only ONE "Fetching page 1..." message
- Console shows "Fetched 100 issues from page 1"
- No second page fetch (pagination terminates correctly)
- All 100 issues are displayed

**Example Console Output:**
```
Fetching page 1 of issues from owner/exact-100...
Fetched 100 issues from page 1
Total fetched: 100 items (issues + PRs)
After filtering PRs: 87 issues
Filtered out 13 pull requests
```

---

### Test 4: Pull Request Filtering

**Objective:** Verify pull requests are correctly filtered out

**Steps:**
1. Find a repository with both issues and pull requests (most repos have both)
2. Enter the repository in the GitHub Issues page
3. Click the "Refresh" button
4. Review the displayed list
5. Check the console log for PR filtering summary

**Expected Results:**
- Displayed list shows ONLY issues (no pull requests)
- Console shows "Filtered out X pull requests" where X > 0
- Each item in the list is an issue (no "PR" badges or pull request indicators)
- Issue count matches GitHub's "Issues" tab count (not "Pull requests")

**Verification:**
- Manually check GitHub repository:
  - Go to repository's "Issues" tab → note the count
  - Go to repository's "Pull requests" tab → note the count
- Compare with app's displayed count
- App should show same count as GitHub's "Issues" tab

---

### Test 5: Filter State Preservation (Open/Closed/All)

**Objective:** Verify filter state is correctly passed to GitHub API during pagination

**Steps:**
1. Enter a repository with >100 issues
2. Select "Open" filter
3. Click "Refresh"
4. Observe console and displayed issues
5. Select "Closed" filter
6. Click "Refresh"
7. Observe console and displayed issues
8. Select "All" filter
9. Click "Refresh"
10. Observe console and displayed issues

**Expected Results:**
- "Open" filter: Only open issues are displayed, pagination fetches open issues
- "Closed" filter: Only closed issues are displayed, pagination fetches closed issues
- "All" filter: Both open and closed issues are displayed
- Each filter selection triggers complete pagination loop
- Console logs show correct number of issues for each state

**Verification:**
- Compare counts with GitHub website for each filter state
- GitHub API URL in network tab should include `state=open|closed|all`

---

### Test 6: Empty Repository

**Objective:** Verify graceful handling of repositories with zero issues

**Steps:**
1. Find or create a repository with no issues
2. Enter the repository in the GitHub Issues page
3. Click "Refresh" button
4. Observe console and UI

**Expected Results:**
- Console shows: "Fetching page 1..." then "Fetched 0 issues from page 1"
- Console shows: "Total fetched: 0 items", "After filtering PRs: 0 issues"
- UI shows empty state or "No issues found" message
- No errors in console
- App doesn't crash or hang

---

### Test 7: Error Handling (Invalid Repository)

**Objective:** Verify graceful error handling for invalid repositories

**Steps:**
1. Enter an invalid repository name (e.g., "nonexistent/repo-xyz123")
2. Click "Refresh" button
3. Observe UI and console

**Expected Results:**
- Error message is displayed to user (not silent failure)
- Console shows error log
- App doesn't crash
- User can try again with a different repository

---

### Test 8: Network Error Handling

**Objective:** Verify behavior when network fails during pagination

**Steps:**
1. Start fetching a large repository (>100 issues)
2. Disconnect internet or block GitHub API during fetch
3. Observe behavior

**Expected Results:**
- Error message displayed
- Console shows error log
- Partial results (if any) are handled gracefully
- App doesn't crash or hang

---

## Test Repositories Suggestions

### Large Repositories (>1000 issues)
- `facebook/react` - 10,000+ issues
- `microsoft/vscode` - 10,000+ issues
- `vercel/next.js` - 5,000+ issues

### Medium Repositories (100-500 issues)
- Search for repositories with issue counts in this range

### Small Repositories (<100 issues)
- New/test repositories
- Personal repositories with minimal activity

### Exact 100 Issues
- Difficult to find naturally, may need to create a test repository

### Repositories with High PR Ratio
- Active projects with many PRs to verify PR filtering

---

## Console Log Reference

### Success Log Pattern
```
Fetching page {page} of issues from {repo}...
Fetched {count} issues from page {page}
Fetching page {page+1} of issues from {repo}...
Fetched {count} issues from page {page+1}
...
Total fetched: {total} items (issues + PRs)
After filtering PRs: {issues_only} issues
Filtered out {pr_count} pull requests
```

### Error Log Pattern
```
Failed to fetch issues: {error message}
```

---

## Verification Checklist

For each test scenario, verify:

- [ ] Correct number of pages fetched
- [ ] Console logs show page fetches
- [ ] Issue count matches GitHub website
- [ ] Pull requests are filtered out
- [ ] Filter state (open/closed/all) works correctly
- [ ] No console errors during normal operation
- [ ] Loading state displays during fetch
- [ ] UI updates after fetch completes
- [ ] Error handling works for invalid repos
- [ ] App doesn't crash or hang

---

## Network Tab Verification

For additional verification, use the Network tab in Developer Tools:

1. Open DevTools (F12 or Cmd+Option+I)
2. Go to "Network" tab
3. Filter by "XHR" or "Fetch"
4. Click "Refresh" in the app
5. Observe GitHub API requests

**Expected:**
- Multiple requests to `api.github.com/repos/{owner}/{repo}/issues`
- Each request includes `page=X&per_page=100` parameter
- Each request includes `state=open|closed|all` parameter
- Last page returns <100 issues

---

## Performance Notes

- Large repositories (1000+ issues) may take several seconds to fetch
- Each page request adds ~200-500ms latency
- 1000 issues = ~10 pages = ~2-5 seconds total
- This is expected behavior and acceptable

---

## Known Limitations

1. **No Progress Indicator**: Users see loading spinner but not page progress
2. **No Caching**: Every refresh fetches all pages again
3. **Rate Limiting**: GitHub API has 5,000 requests/hour limit for authenticated tokens

These limitations are acceptable for the current implementation and can be improved in future iterations.
