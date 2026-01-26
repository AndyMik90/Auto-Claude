# Bug #1525: Windows Path Normalization and Credential Lookup Failures

## Summary

Windows path separator inconsistencies caused credential lookup failures when using Claude profiles. The fix normalizes paths before hashing and adds a file-based credential fallback for Windows.

## Root Cause

Two separate issues were discovered:

### Issue 1: Path Separator Inconsistency

Claude CLI normalizes paths internally before hashing the `configDir` to create unique credential storage keys. Auto Claude was not doing the same normalization, resulting in hash mismatches.

**Example:**
- Stored configDir: `C:\Users\bill/.claude-profiles/sc` (mixed separators)
- Claude CLI hashes: `C:\Users\bill\.claude-profiles\sc` (normalized)
- Auto Claude hashed: `C:\Users\bill/.claude-profiles/sc` (not normalized)
- Result: Different hashes = credentials not found

### Issue 2: Windows Credential Storage Location

Claude CLI on Windows sometimes stores credentials in `.credentials.json` file instead of Windows Credential Manager. Auto Claude only checked Credential Manager, missing file-based credentials.

### Issue 3: Tilde Expansion in Profile Creation

The `CLAUDE_PROFILE_SAVE` handler passed `configDir` with `~` prefix directly to `existsSync`/`mkdirSync`, which don't understand `~` expansion. This caused directory creation to fail for new profiles.

## Files Changed

| File | Changes |
|------|---------|
| `credential-utils.ts` | Added `path.normalize()` before hashing; added Windows file fallback functions |
| `claude-profile-manager.ts` | Added `path.normalize()` in `getActiveProfileEnv()` and `getProfileEnv()` |
| `terminal-handlers.ts` | Fixed `~` expansion before filesystem operations |
| `credential-utils.test.ts` | Added tests for Windows file fallback scenarios |

## Fix Details

### Path Normalization

Added `path.normalize()` calls before hashing configDir paths:

```typescript
// credential-utils.ts - getKeychainServiceName()
const normalizedConfigDir = normalize(expandedConfigDir);
const hash = calculateConfigDirHash(normalizedConfigDir);
```

```typescript
// claude-profile-manager.ts - getActiveProfileEnv() and getProfileEnv()
env.CLAUDE_CONFIG_DIR = normalize(expandedConfigDir);
```

### Windows File Fallback

Added functions to read credentials from `.credentials.json` when Credential Manager doesn't have them:

- `getWindowsCredentialsPath()` - Returns path to `.credentials.json`
- `getCredentialsFromWindowsFile()` - Reads basic credentials from file
- `getCredentialsFromWindows()` - Tries Credential Manager first, falls back to file
- `getFullCredentialsFromWindowsFile()` - Reads full credentials (with refresh token)
- `getFullCredentialsFromWindows()` - Wrapper with fallback for full credentials

### Tilde Expansion Fix

```typescript
// terminal-handlers.ts - CLAUDE_PROFILE_SAVE handler
const expandedConfigDir = profile.configDir.startsWith('~')
  ? profile.configDir.replace(/^~/, homedir())
  : profile.configDir;

if (!existsSync(expandedConfigDir)) {
  mkdirSync(expandedConfigDir, { recursive: true });
}
```

## Testing

- All 2502 tests pass
- Manually tested on Windows:
  - Creating new profiles works
  - Both OAuth profiles authenticate correctly
  - Usage data fetches correctly for both profiles
  - Mixed path separator configDirs are handled correctly

## PR

- PR #1538: https://github.com/AndyMik90/Auto-Claude/pull/1538

## Related

- Issue #1525: https://github.com/AndyMik90/Auto-Claude/issues/1525
- Commit 1e72c8d7: Original hash-based credential isolation commit
