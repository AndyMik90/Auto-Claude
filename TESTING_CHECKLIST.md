# Testing Checklist - Ollama + Batch Tasks

## Quick Start

```bash
# Terminal 1: Start dev UI
cd /Users/ray/dev/decent/Auto-Claude
npm run dev

# Terminal 2: Test CLI
cd /Users/ray/dev/decent/Auto-Claude

# Test batch task creation
python apps/backend/run.py --batch-create batch_test.json

# View batch status
python apps/backend/run.py --batch-status

# Preview cleanup
python apps/backend/run.py --batch-cleanup
```

## UI Testing (Ollama Feature)

### Component Loading
- [ ] Electron window opens without errors
- [ ] No console errors in DevTools (F12)
- [ ] OllamaModelSelector component loads
- [ ] Base URL input field visible

### Model Scanning
- [ ] Can enter Ollama base URL (e.g., http://localhost:11434)
- [ ] Scan models button works
- [ ] Models list displays (if local Ollama running)

### Download Progress (NEW)
- [ ] Download button initiates model download
- [ ] Progress bar appears
- [ ] Speed displays (MB/s, KB/s, B/s)
- [ ] Time remaining calculated
- [ ] Percentage updates in real-time
- [ ] Progress bar animates smoothly
- [ ] Download completes successfully

### IPC Communication
- [ ] F12 Console shows onDownloadProgress events
- [ ] No network errors
- [ ] Main process ↔ Renderer communication works
- [ ] Memory handlers process NDJSON correctly

## CLI Testing (Batch Tasks)

### Batch Creation
- [ ] File exists: `batch_test.json`
- [ ] Command: `python apps/backend/run.py --batch-create batch_test.json`
- [ ] Shows status for each task created
- [ ] Creates 3 new specs (001, 002, 003)
- [ ] Each spec has `requirements.json`
- [ ] Priority, complexity, services set correctly

### Batch Status
- [ ] Command: `python apps/backend/run.py --batch-status`
- [ ] Lists all specs with status
- [ ] Shows titles for each spec
- [ ] Shows current state (pending_spec, spec_created, building, etc.)
- [ ] Formatted output is readable

### Batch Cleanup
- [ ] Command: `python apps/backend/run.py --batch-cleanup`
- [ ] Shows preview of what would be deleted
- [ ] Lists completed specs (if any)
- [ ] Lists associated worktrees
- [ ] Dry-run mode (default) doesn't delete
- [ ] With `--no-dry-run` actually deletes

## Integration Testing

### Files Structure
- [ ] `.auto-claude/specs/001-*` directory exists
- [ ] `.auto-claude/specs/002-*` directory exists
- [ ] `.auto-claude/specs/003-*` directory exists
- [ ] Each has `requirements.json`
- [ ] Each has `memory/` subdirectory

### CLI Integration
- [ ] Batch create works with old CLI structure
- [ ] Batch commands integrated into main.py
- [ ] Help text available: `python apps/backend/run.py --help`
- [ ] Error handling for missing files
- [ ] Error handling for invalid JSON

### Ollama Feature Files
- [ ] OllamaModelSelector.tsx exists in correct location
- [ ] ndjson-parser.test.ts exists
- [ ] OllamaModelSelector.progress.test.ts exists
- [ ] All imports path correctly to new structure
- [ ] No broken dependencies

## Edge Cases

- [ ] Handle empty batch file
- [ ] Handle missing required fields in JSON
- [ ] Handle duplicate task titles
- [ ] Handle special characters in titles
- [ ] Large file downloads (>1GB)
- [ ] Network interruption during download
- [ ] Invalid Ollama base URL
- [ ] Cleanup with no specs

## Performance

- [ ] UI responsive during progress updates
- [ ] No memory leaks in progress tracking
- [ ] IPC events don't spam console
- [ ] Speed calculations accurate
- [ ] Time remaining estimates reasonable

## Code Quality

- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] No console errors/warnings
- [ ] Proper error handling
- [ ] User-friendly error messages

## Test Results

Date: _______________

### Ollama Feature
- [ ] ✅ UI renders correctly
- [ ] ✅ Progress tracking works
- [ ] ✅ Speed calculation accurate
- [ ] ✅ Time remaining estimates correct
- [ ] ✅ No console errors

### Batch Tasks
- [ ] ✅ Create works
- [ ] ✅ Status shows correctly
- [ ] ✅ Cleanup preview accurate
- [ ] ✅ Error handling works
- [ ] ✅ JSON parsing correct

### Overall
- [ ] ✅ All features working
- [ ] ✅ Ready for PR review
- [ ] ✅ Ready to merge to develop

## Notes

_Add any issues or observations here_

