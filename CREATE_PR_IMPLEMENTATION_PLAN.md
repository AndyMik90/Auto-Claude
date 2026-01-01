# Create PR Feature - Implementation Plan

**Date:** 2026-01-01
**Status:** Ready for Implementation
**Estimated Complexity:** MODERATE (6-8 hours)

---

## Overview

Implement a "Create PR" feature that allows users to create GitHub/GitLab pull requests from completed specs instead of directly merging to main. This enables code review workflow integration.

**Key Requirements:**
- Create GitHub/GitLab PRs from workspace branches
- Check for merge conflicts before PR creation
- Auto-fill PR title and description from spec.md
- Add UI button in WorkspaceStatus component
- Support both GitHub and GitLab

---

## Phase 1: Backend - Add PR Creation Method ✅ REVIEWED

### File: `apps/backend/runners/github/gh_client.py`

**Add new method:** `pr_create()`

```python
async def pr_create(
    self,
    base: str,
    head: str,
    title: str,
    body: str,
    draft: bool = False
) -> Dict[str, Any]:
    """
    Create a new pull request.

    Args:
        base: Base branch (e.g., "main", "master")
        head: Head branch (e.g., "feature/my-feature")
        title: PR title
        body: PR description
        draft: Whether to create as draft PR (default: False)

    Returns:
        Dict containing PR data:
        {
            "number": int,
            "url": str,
            "title": str,
            "state": str,
            "html_url": str
        }

    Raises:
        GitHubError: If PR creation fails
    """
    args = [
        "pr", "create",
        "--base", base,
        "--head", head,
        "--title", title,
        "--body", body,
        "--json", "number,url,title,state"
    ]

    if draft:
        args.append("--draft")

    result = await self._run_gh_command(args)
    return json.loads(result)
```

**Location in file:** Add after `pr_merge()` method (around line 350)

**Dependencies:**
- Uses existing `_run_gh_command()` method
- Follows same pattern as `pr_list()`, `pr_get()`, etc.
- No new imports needed

---

## Phase 2: Backend - Add Conflict Detection Utility

### File: `apps/backend/core/workspace/git_utils.py` (if exists) OR create new file

**Add utility function:**

```python
from typing import Tuple
import subprocess

def check_merge_conflicts(
    repo_path: str,
    source_branch: str,
    target_branch: str
) -> Tuple[bool, str]:
    """
    Check if merging source branch into target would cause conflicts.

    Args:
        repo_path: Path to git repository
        source_branch: Branch to merge from
        target_branch: Branch to merge into

    Returns:
        Tuple of (has_conflicts: bool, message: str)
        - (False, "No conflicts") if merge is clean
        - (True, "Conflicts in: file1.py, file2.ts") if conflicts exist
    """
    try:
        # Fetch latest changes
        subprocess.run(
            ["git", "fetch", "origin"],
            cwd=repo_path,
            check=True,
            capture_output=True
        )

        # Check if merge would have conflicts using --no-commit --no-ff
        result = subprocess.run(
            ["git", "merge", "--no-commit", "--no-ff", f"origin/{source_branch}"],
            cwd=repo_path,
            capture_output=True,
            text=True
        )

        # Abort the merge attempt
        subprocess.run(
            ["git", "merge", "--abort"],
            cwd=repo_path,
            check=False,
            capture_output=True
        )

        if result.returncode != 0:
            # Parse conflict files from stderr
            conflict_files = []
            for line in result.stderr.split('\n'):
                if 'CONFLICT' in line:
                    # Extract filename from git conflict message
                    # Example: "CONFLICT (content): Merge conflict in file.py"
                    parts = line.split(' in ')
                    if len(parts) > 1:
                        conflict_files.append(parts[1].strip())

            conflicts_str = ", ".join(conflict_files) if conflict_files else "multiple files"
            return True, f"Conflicts in: {conflicts_str}"

        return False, "No conflicts"

    except subprocess.CalledProcessError as e:
        return True, f"Error checking conflicts: {str(e)}"
```

---

## Phase 3: Backend - Add Spec Info Extraction Utility

### File: `apps/backend/core/workspace/spec_utils.py` (if exists) OR create new file

**Add utility function:**

```python
from pathlib import Path
from typing import Tuple, Optional

def extract_pr_info_from_spec(spec_path: str) -> Tuple[str, str]:
    """
    Extract PR title and description from spec.md.

    Args:
        spec_path: Path to spec.md file

    Returns:
        Tuple of (title: str, body: str)
        - title: First heading from spec (e.g., "# Specification: Feature Name")
        - body: Full spec content or summary
    """
    spec_file = Path(spec_path)

    if not spec_file.exists():
        return "Feature Implementation", "Automated PR from Auto-Claude"

    content = spec_file.read_text(encoding='utf-8')
    lines = content.split('\n')

    # Extract title from first heading
    title = "Feature Implementation"
    for line in lines:
        if line.startswith('# '):
            title = line.replace('# ', '').replace('Specification: ', '').strip()
            break

    # Create body from spec content
    # Option 1: Use full spec (may be long)
    body = content

    # Option 2: Use summary sections (cleaner)
    # body = _extract_summary_sections(content)

    return title, body


def _extract_summary_sections(content: str) -> str:
    """Extract key sections for PR description."""
    sections_to_include = [
        '## Overview',
        '## Task Scope',
        '## Requirements',
        '## Success Criteria'
    ]

    lines = content.split('\n')
    result_lines = []
    in_section = False

    for line in lines:
        # Check if we're entering a section to include
        if any(line.startswith(section) for section in sections_to_include):
            in_section = True
            result_lines.append(line)
        # Check if we're entering a different section
        elif line.startswith('## ') and not any(line.startswith(section) for section in sections_to_include):
            in_section = False
        # Add lines if we're in a section to include
        elif in_section:
            result_lines.append(line)

    return '\n'.join(result_lines)
```

---

## Phase 4: Frontend - Add IPC Channel Constants

### File: `apps/frontend/src/shared/constants/ipc.ts`

**Location:** After line 358 (after existing GitHub PR channels)

**Add these constants:**

```typescript
// GitHub PR Create operation
GITHUB_PR_CREATE: 'github:pr:create',

// GitHub PR Create events (main -> renderer)
GITHUB_PR_CREATE_PROGRESS: 'github:pr:createProgress',
GITHUB_PR_CREATE_COMPLETE: 'github:pr:createComplete',
GITHUB_PR_CREATE_ERROR: 'github:pr:createError',
```

**Result:** Lines 359-366 will contain the new PR creation channels

---

## Phase 5: Frontend - Add IPC Handler

### File: `apps/frontend/src/main/ipc-handlers/github/pr-handlers.ts`

**Location:** Inside `registerPRHandlers()` function (around line 960, after existing handlers)

**Add handler registration:**

```typescript
/**
 * Create a new pull request
 *
 * Long-running operation that:
 * 1. Validates GitHub configuration
 * 2. Checks for merge conflicts
 * 3. Extracts PR info from spec.md
 * 4. Creates PR via gh CLI
 */
ipcMain.on(
  IPC_CHANNELS.GITHUB_PR_CREATE,
  async (
    _,
    projectId: string,
    options: {
      baseBranch: string;
      headBranch: string;
      specPath?: string;
      draft?: boolean;
    }
  ) => {
    debugLog('createPR handler called', { projectId, options });
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      debugLog('No main window available');
      return;
    }

    try {
      await withProjectOrNull(projectId, async (project) => {
        const { sendProgress, sendError, sendComplete } = createIPCCommunicators<
          PRCreateProgress,
          PRCreateResult
        >(
          mainWindow,
          {
            progress: IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS,
            error: IPC_CHANNELS.GITHUB_PR_CREATE_ERROR,
            complete: IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE,
          },
          projectId
        );

        try {
          const result = await runPRCreate(project, options, mainWindow);
          sendComplete(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to create PR';
          debugLog('Failed to create PR', { error: errorMessage });
          sendError(errorMessage);
        }
      });
    } catch (error) {
      const { sendError } = createIPCCommunicators<PRCreateProgress, PRCreateResult>(
        mainWindow,
        {
          progress: IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS,
          error: IPC_CHANNELS.GITHUB_PR_CREATE_ERROR,
          complete: IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE,
        },
        projectId
      );
      sendError(error instanceof Error ? error.message : 'Failed to create PR');
    }
  }
);
```

**Add supporting types at top of file (after imports, around line 30):**

```typescript
interface PRCreateProgress {
  stage: 'validating' | 'checking_conflicts' | 'extracting_info' | 'creating_pr';
  message: string;
  percent?: number;
}

interface PRCreateResult {
  success: boolean;
  pr?: {
    number: number;
    url: string;
    title: string;
    state: string;
  };
  error?: string;
}
```

**Add implementation function (after other helper functions, around line 650):**

```typescript
/**
 * Create a new pull request
 */
async function runPRCreate(
  project: Project,
  options: {
    baseBranch: string;
    headBranch: string;
    specPath?: string;
    draft?: boolean;
  },
  mainWindow: BrowserWindow
): Promise<PRCreateResult> {
  // Validate GitHub module
  const validation = await validateGitHubModule(project);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const backendPath = validation.backendPath!;

  const { sendProgress } = createIPCCommunicators<PRCreateProgress, PRCreateResult>(
    mainWindow,
    {
      progress: IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS,
      error: IPC_CHANNELS.GITHUB_PR_CREATE_ERROR,
      complete: IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE,
    },
    project.id
  );

  // Stage 1: Validation
  sendProgress({
    stage: 'validating',
    message: 'Validating GitHub configuration...',
    percent: 10
  });

  // Stage 2: Check conflicts
  sendProgress({
    stage: 'checking_conflicts',
    message: 'Checking for merge conflicts...',
    percent: 30
  });

  // Stage 3: Extract PR info
  sendProgress({
    stage: 'extracting_info',
    message: 'Extracting PR information from spec...',
    percent: 50
  });

  // Stage 4: Create PR
  sendProgress({
    stage: 'creating_pr',
    message: 'Creating pull request...',
    percent: 70
  });

  const { model, thinkingLevel } = getGitHubPRSettings();
  const args = buildRunnerArgs(
    getRunnerPath(backendPath),
    project.path,
    'create-pr',
    [
      options.baseBranch,
      options.headBranch,
      options.specPath || '',
      options.draft ? '--draft' : ''
    ].filter(Boolean),
    { model, thinkingLevel }
  );

  const subprocessEnv = getAugmentedEnv(backendPath);

  const { process: childProcess, promise } = runPythonSubprocess<PRCreateResult>({
    pythonPath: getPythonPath(backendPath),
    args,
    cwd: backendPath,
    env: subprocessEnv,
    onProgress: (percent, message) => {
      sendProgress({
        stage: 'creating_pr',
        message,
        percent: 70 + (percent * 0.3) // Scale to 70-100%
      });
    },
    onStdout: (line) => {
      debugLog('PR create stdout:', line);
    },
    onStderr: (line) => {
      debugLog('PR create stderr:', line);
    },
    onComplete: () => {
      // Result should be returned from subprocess
      return {
        success: true,
        pr: undefined, // Will be filled by subprocess
      };
    },
  });

  try {
    const result = await promise;
    if (!result.success) {
      throw new Error(result.error ?? 'PR creation failed');
    }
    return result.data!;
  } finally {
    // Cleanup
    if (childProcess && !childProcess.killed) {
      childProcess.kill();
    }
  }
}
```

---

## Phase 6: Frontend - Add UI Button

### File: `apps/frontend/src/renderer/components/task-detail/task-review/WorkspaceStatus.tsx`

**Location:** Lines 385-404 (in the primary actions section)

**Current code:**
```typescript
{/* Primary Actions */}
<div className="flex gap-2">
  <Button
    variant={hasGitConflicts || isBranchBehind || hasPathMappedMerges ? "warning" : "success"}
    onClick={onMerge}
    disabled={isMerging || isDiscarding}
    className="flex-1"
  >
    {/* ... merge button content ... */}
  </Button>
  <Button
    variant="outline"
    size="icon"
    onClick={() => onShowDiscardDialog(true)}
    disabled={isMerging || isDiscarding}
    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
    title="Discard build"
  >
    <FolderX className="h-4 w-4" />
  </Button>
</div>
```

**Replace with:**
```typescript
{/* Primary Actions */}
<div className="flex gap-2">
  {/* Merge Button */}
  <Button
    variant={hasGitConflicts || isBranchBehind || hasPathMappedMerges ? "warning" : "success"}
    onClick={onMerge}
    disabled={isMerging || isDiscarding || isCreatingPR}
    className="flex-1"
  >
    {isMerging ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {hasGitConflicts || isBranchBehind || hasPathMappedMerges ? 'Resolving...' : stageOnly ? 'Staging...' : 'Merging...'}
      </>
    ) : (
      <>
        <GitMerge className="mr-2 h-4 w-4" />
        {hasGitConflicts || isBranchBehind || hasPathMappedMerges
          ? (stageOnly ? 'Stage with AI Merge' : 'Merge with AI')
          : (stageOnly ? 'Stage Changes' : 'Merge to Main')}
      </>
    )}
  </Button>

  {/* Create PR Button */}
  <Button
    variant="outline"
    onClick={onCreatePR}
    disabled={isMerging || isDiscarding || isCreatingPR || hasGitConflicts}
    className="flex-1"
    title={hasGitConflicts ? "Resolve conflicts before creating PR" : "Create pull request for review"}
  >
    {isCreatingPR ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('workspace.creatingPR')}
      </>
    ) : (
      <>
        <GitPullRequest className="mr-2 h-4 w-4" />
        {t('workspace.createPR')}
      </>
    )}
  </Button>

  {/* Discard Button */}
  <Button
    variant="outline"
    size="icon"
    onClick={() => onShowDiscardDialog(true)}
    disabled={isMerging || isDiscarding || isCreatingPR}
    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
    title={t('workspace.discardBuild')}
  >
    <FolderX className="h-4 w-4" />
  </Button>
</div>
```

**Add state and handler at top of component:**

```typescript
// Add to existing state declarations (around line 50)
const [isCreatingPR, setIsCreatingPR] = useState(false);
const [prCreateProgress, setPRCreateProgress] = useState<{
  stage: string;
  message: string;
  percent?: number;
} | null>(null);

// Add handler function (around line 200, after other handlers)
const onCreatePR = useCallback(async () => {
  if (!project) return;

  setIsCreatingPR(true);
  setPRCreateProgress({
    stage: 'validating',
    message: 'Starting PR creation...',
    percent: 0
  });

  try {
    // Send IPC message to create PR
    window.electron.ipcRenderer.send(IPC_CHANNELS.GITHUB_PR_CREATE, project.id, {
      baseBranch: 'main', // TODO: Get from project config
      headBranch: project.currentBranch || 'feature/unknown',
      specPath: project.specPath,
      draft: false
    });

    // Listen for progress
    const progressListener = (_: any, data: any) => {
      if (data.projectId === project.id) {
        setPRCreateProgress(data);
      }
    };

    // Listen for completion
    const completeListener = (_: any, data: any) => {
      if (data.projectId === project.id) {
        setIsCreatingPR(false);
        setPRCreateProgress(null);

        if (data.success && data.pr) {
          // Show success message
          toast.success(t('workspace.prCreated', { number: data.pr.number }));

          // Optionally open PR in browser
          if (data.pr.url) {
            window.electron.shell.openExternal(data.pr.url);
          }
        }

        // Cleanup listeners
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS, progressListener);
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE, completeListener);
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_ERROR, errorListener);
      }
    };

    // Listen for errors
    const errorListener = (_: any, data: any) => {
      if (data.projectId === project.id) {
        setIsCreatingPR(false);
        setPRCreateProgress(null);
        toast.error(t('workspace.prCreateFailed', { error: data.error }));

        // Cleanup listeners
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS, progressListener);
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE, completeListener);
        window.electron.ipcRenderer.removeListener(IPC_CHANNELS.GITHUB_PR_CREATE_ERROR, errorListener);
      }
    };

    window.electron.ipcRenderer.on(IPC_CHANNELS.GITHUB_PR_CREATE_PROGRESS, progressListener);
    window.electron.ipcRenderer.on(IPC_CHANNELS.GITHUB_PR_CREATE_COMPLETE, completeListener);
    window.electron.ipcRenderer.on(IPC_CHANNELS.GITHUB_PR_CREATE_ERROR, errorListener);

  } catch (error) {
    setIsCreatingPR(false);
    setPRCreateProgress(null);
    toast.error(t('workspace.prCreateFailed', { error: String(error) }));
  }
}, [project, t]);
```

**Add import for GitPullRequest icon (around line 10):**

```typescript
import { GitMerge, FolderX, GitPullRequest, Loader2, /* other icons */ } from 'lucide-react';
```

---

## Phase 7: Frontend - Add i18n Translation Keys

### File: `apps/frontend/src/shared/i18n/locales/en/workspace.json`

**Add these keys:**

```json
{
  "createPR": "Create PR",
  "creatingPR": "Creating PR...",
  "prCreated": "Pull request #{{number}} created successfully",
  "prCreateFailed": "Failed to create PR: {{error}}",
  "discardBuild": "Discard build"
}
```

### File: `apps/frontend/src/shared/i18n/locales/fr/workspace.json`

**Add these keys:**

```json
{
  "createPR": "Créer PR",
  "creatingPR": "Création PR...",
  "prCreated": "Pull request #{{number}} créée avec succès",
  "prCreateFailed": "Échec de la création de PR: {{error}}",
  "discardBuild": "Abandonner la construction"
}
```

---

## Phase 8: Backend - Add CLI Command (Optional)

### File: `apps/backend/cli/workspace_commands.py`

**Add new command for PR creation:**

```python
@workspace_group.command('create-pr')
@click.argument('base_branch')
@click.argument('head_branch')
@click.option('--spec-path', help='Path to spec.md file')
@click.option('--draft', is_flag=True, help='Create as draft PR')
@click.pass_context
def create_pr(
    ctx: click.Context,
    base_branch: str,
    head_branch: str,
    spec_path: Optional[str],
    draft: bool
):
    """Create a pull request from workspace branch."""
    from ..runners.github.gh_client import GHClient
    from ..core.workspace.spec_utils import extract_pr_info_from_spec
    from ..core.workspace.git_utils import check_merge_conflicts

    project_path = ctx.obj['project_path']

    # Check for conflicts
    has_conflicts, conflict_msg = check_merge_conflicts(
        project_path,
        head_branch,
        base_branch
    )

    if has_conflicts:
        click.echo(f"⚠️  Warning: {conflict_msg}", err=True)
        if not click.confirm("Continue with PR creation despite conflicts?"):
            raise click.Abort()

    # Extract PR info from spec
    if spec_path and os.path.exists(spec_path):
        title, body = extract_pr_info_from_spec(spec_path)
    else:
        title = f"Feature: {head_branch}"
        body = "Automated PR from Auto-Claude"

    # Create PR
    client = GHClient(project_path)

    async def _create():
        result = await client.pr_create(
            base=base_branch,
            head=head_branch,
            title=title,
            body=body,
            draft=draft
        )
        return result

    import asyncio
    pr_data = asyncio.run(_create())

    click.echo(f"✅ Created PR #{pr_data['number']}: {pr_data['title']}")
    click.echo(f"   URL: {pr_data['url']}")
```

---

## Testing Strategy

### Unit Tests

**Test File:** `apps/backend/tests/test_gh_client.py`

```python
async def test_pr_create(self):
    """Test PR creation"""
    client = GHClient(self.project_path)

    pr_data = await client.pr_create(
        base='main',
        head='feature/test',
        title='Test PR',
        body='Test description'
    )

    assert pr_data['number'] > 0
    assert pr_data['title'] == 'Test PR'
    assert pr_data['state'] == 'open'
```

**Test File:** `apps/backend/tests/test_spec_utils.py`

```python
def test_extract_pr_info_from_spec(tmp_path):
    """Test extracting PR info from spec.md"""
    spec_path = tmp_path / "spec.md"
    spec_path.write_text("""# Specification: User Authentication

## Overview
Add user authentication with OAuth.

## Requirements
- OAuth integration
- User sessions
""")

    title, body = extract_pr_info_from_spec(str(spec_path))

    assert title == "User Authentication"
    assert "OAuth" in body
```

### Integration Tests

1. **Test PR creation with conflicts:**
   - Create branch with conflicting changes
   - Attempt PR creation
   - Verify conflict detection

2. **Test PR creation success:**
   - Create clean branch with changes
   - Create PR
   - Verify PR appears in GitHub

3. **Test UI integration:**
   - Open workspace with changes
   - Click "Create PR" button
   - Verify progress indicators
   - Verify success message

### E2E Test

**Test File:** `apps/frontend/test/e2e/workspace-pr.spec.ts`

```typescript
test('should create PR from workspace', async ({ page }) => {
  // Navigate to workspace
  await page.goto('/#/task/123');

  // Wait for workspace to load
  await page.waitForSelector('[data-testid="workspace-status"]');

  // Click Create PR button
  await page.click('[data-testid="create-pr-button"]');

  // Wait for progress indicator
  await page.waitForSelector('text=Creating PR...');

  // Wait for success message
  await page.waitForSelector('text=Pull request #');

  // Verify PR was created (check toast notification)
  const toast = page.locator('[data-testid="toast-success"]');
  await expect(toast).toContainText('created successfully');
});
```

---

## Implementation Order

1. ✅ **Phase 1:** Backend - Add `pr_create()` method to `gh_client.py`
2. ✅ **Phase 2:** Backend - Add conflict detection utility
3. ✅ **Phase 3:** Backend - Add spec info extraction utility
4. ✅ **Phase 4:** Frontend - Add IPC channel constants
5. ✅ **Phase 5:** Frontend - Add IPC handler in `pr-handlers.ts`
6. ✅ **Phase 6:** Frontend - Add UI button to `WorkspaceStatus.tsx`
7. ✅ **Phase 7:** Frontend - Add i18n translation keys
8. ✅ **Phase 8:** Testing - Unit, integration, and E2E tests

---

## Dependencies

**No new package dependencies required** - uses existing infrastructure:
- ✅ Backend: `gh` CLI (already installed)
- ✅ Frontend: Electron IPC (already configured)
- ✅ Frontend: lucide-react icons (already installed)
- ✅ Frontend: react-i18next (already configured)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Merge conflicts not detected | Low | Medium | Thorough testing of conflict detection logic |
| PR creation fails silently | Low | High | Comprehensive error handling and user feedback |
| Spec.md parsing issues | Medium | Low | Fallback to default title/body |
| GitLab compatibility | Medium | Medium | Test with both GitHub and GitLab repositories |

---

## Success Criteria

- ✅ Users can create PRs from workspace UI with one click
- ✅ Conflicts are detected before PR creation
- ✅ PR title and description auto-populated from spec.md
- ✅ Progress feedback shown during creation
- ✅ Success/error messages displayed appropriately
- ✅ Works with both GitHub and GitLab
- ✅ All tests pass
- ✅ No regressions in existing merge functionality

---

## Rollout Plan

1. **Development:** Implement all 7 phases
2. **Testing:** Run unit, integration, and E2E tests
3. **Code Review:** Review with team
4. **Deploy:** Merge to main branch
5. **Monitor:** Watch for issues in production
6. **Document:** Update user documentation

---

## Future Enhancements

- Auto-assign reviewers based on CODEOWNERS
- Support for PR templates
- Support for PR labels/milestones
- Draft PR by default with option to mark ready
- Link PR to related issues automatically
