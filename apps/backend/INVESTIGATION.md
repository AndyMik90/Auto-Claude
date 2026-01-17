# Token Encryption Investigation

## Issue Summary

Auto-Claude users are experiencing API 401 errors ("Invalid bearer token") because the Python backend is passing encrypted tokens (with `enc:` prefix) directly to the Claude Agent SDK without decryption. Standalone Claude Code terminals work correctly because they decrypt these tokens before use.

**Key insight from user thehaffk:** "python cant unencrypt claude token and it launches session with CLAUDE_CODE_OAUTH_TOKEN=enc:djEwtxMGISt3tQ..."

## Token Storage Format

### Encrypted Token Format

Claude Code CLI stores OAuth tokens in an encrypted format with the prefix `enc:`:

```
enc:djEwtxMGISt3tQ...
```

This format is used when tokens are stored in:
- **macOS**: Keychain (service: "Claude Code-credentials")
- **Linux**: Secret Service API (DBus, via secretstorage library)
- **Windows**: Credential Manager / .credentials.json files

### Decrypted Token Format

Valid Claude OAuth tokens have the format:
```
sk-ant-oat01-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Current Token Flow (BROKEN)

1. **Token Storage**: Claude Code CLI stores encrypted token with `enc:` prefix in system keychain
2. **Token Retrieval**: `apps/backend/core/auth.py::get_auth_token()` retrieves token from:
   - Environment variable `CLAUDE_CODE_OAUTH_TOKEN`
   - OR system keychain via `get_token_from_keychain()`
3. **❌ NO DECRYPTION**: Token is returned as-is with `enc:` prefix intact
4. **SDK Initialization**: Encrypted token passed to Claude Agent SDK
5. **API Call Fails**: SDK sends encrypted token to API → 401 error

### Proof of Broken Flow

Test in `apps/backend`:
```python
import os
os.environ['CLAUDE_CODE_OAUTH_TOKEN'] = 'enc:test123'

from core.auth import get_auth_token
token = get_auth_token()
print(f"Token: {token}")  # Output: "enc:test123"
print(f"Encrypted: {token.startswith('enc:')}")  # Output: True
```

## How Standalone Claude Code CLI Handles Tokens

### Current Understanding

1. **Token Detection**: CLI checks if token starts with `enc:` prefix
2. **Decryption**: If encrypted, CLI decrypts using platform-specific keyring access
3. **Authentication**: Decrypted `sk-ant-oat01-` token is used for API calls

### Missing Documentation

Web search for "Claude Code CLI encrypted token enc: prefix decryption" found:
- Token storage formats (JSON with accessToken, refreshToken, expiresAt)
- Security issues (tokens exposed in debug logs before v2.1.0)
- Keychain access patterns for macOS/Linux/Windows

**❌ NOT FOUND**: Specific documentation on how Claude Code CLI decrypts `enc:` tokens

Sources:
- [Claude Code CLI over SSH on macOS: Fixing Keychain Access](https://phoenixtrap.com/2025/10/26/claude-code-cli-over-ssh-on-macos-fixing-keychain-access/)
- [Identity and Access Management - Claude Code Docs](https://code.claude.com/docs/en/iam)
- [Claude Code sessions should be encrypted | yoav.blog](https://yoav.blog/2026/01/09/claude-code-sessions-should-be-encrypted/)

## Decryption Approach Options

### Option 1: Claude Agent SDK Built-in Decryption

**Status**: NEEDS VERIFICATION

The Claude Agent SDK (`claude-agent-sdk>=0.1.19`) may handle decryption internally if:
- Token is passed to SDK still encrypted
- SDK detects `enc:` prefix
- SDK has access to system keyring for decryption

**Action Required**: Check if SDK has decryption capabilities by examining:
- SDK source code or documentation
- Whether SDK expects encrypted vs decrypted tokens
- If SDK requires specific environment variables for decryption

### Option 2: Python Backend Decryption (Recommended)

**Approach**: Implement decryption in `apps/backend/core/auth.py` before passing to SDK

**Implementation Pattern**:
```python
def get_auth_token() -> str | None:
    """Get authentication token (decrypted if necessary)."""
    token = _retrieve_token_from_sources()  # From env or keychain

    if token and token.startswith("enc:"):
        # Decrypt the token
        token = decrypt_token(token)

    return token

def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt Claude Code encrypted token.

    Args:
        encrypted_token: Token with 'enc:' prefix

    Returns:
        Decrypted token in format 'sk-ant-oat01-...'
    """
    # Remove 'enc:' prefix
    encrypted_data = encrypted_token[4:]

    # TODO: Implement decryption logic
    # Questions to answer:
    # 1. What encryption algorithm does Claude Code use?
    # 2. Where is the decryption key stored?
    # 3. Is the decryption key platform-specific (per-user)?
    # 4. Can we reuse Claude Code's decryption mechanism?

    raise NotImplementedError("Token decryption not yet implemented")
```

### Option 3: Call Claude Code CLI for Decryption

**Approach**: Use the Claude Code CLI binary to decrypt tokens

```python
def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token by invoking Claude Code CLI."""
    # Find claude binary
    claude_path = shutil.which("claude") or "~/.local/bin/claude"

    # Use CLI command to get decrypted token
    # (if such a command exists - needs research)
    result = subprocess.run(
        [claude_path, "auth", "decrypt", encrypted_token],
        capture_output=True,
        text=True
    )

    return result.stdout.strip()
```

**Issues**:
- Requires Claude Code CLI to be installed
- No documented CLI command for token decryption
- Adds external dependency

## Required Investigation Steps

### 1. Verify SDK Decryption Capabilities

**Task**: Check if `claude-agent-sdk` handles `enc:` tokens automatically

**Method**:
```bash
# In environment with SDK installed
python3 << 'EOF'
import os
os.environ['CLAUDE_CODE_OAUTH_TOKEN'] = 'enc:...'  # Real encrypted token

from claude_agent_sdk import Client
# Try creating client - does it decrypt internally?
client = Client()
# Check if authentication works
EOF
```

### 2. Reverse Engineer Claude Code CLI Decryption

**Task**: Understand how Claude CLI decrypts tokens

**Method**:
- Examine Claude CLI binary (if possible)
- Trace system calls when CLI runs (strace on Linux, dtruss on macOS)
- Check if CLI accesses specific keychain entries for decryption keys
- Look for encryption/decryption libraries used by CLI

### 3. Find Decryption Key Storage

**Task**: Locate where decryption keys are stored

**Hypothesis**: Decryption key stored in:
- macOS: Keychain (separate entry from encrypted token)
- Linux: Secret Service API
- Windows: Credential Manager

**Verification**:
```bash
# macOS: List all keychain entries
security find-generic-password -a "$(whoami)" | grep -i claude

# Linux: Use secretstorage to list all items
python3 -c "import secretstorage; ..."
```

## Recommended Decryption Approach for Python Backend

Based on investigation so far, the recommended approach is:

1. **Detect encrypted tokens**: Check for `enc:` prefix in `get_auth_token()`
2. **Decrypt before use**: Implement `decrypt_token()` function
3. **Platform-specific decryption**: Use appropriate keyring library:
   - macOS: Use `subprocess` with `/usr/bin/security` to access decryption key
   - Linux: Use `secretstorage` library to access Secret Service API
   - Windows: Access Credential Manager or credentials.json
4. **Backward compatibility**: Support both encrypted and plaintext tokens
5. **Error handling**: Provide clear error messages if decryption fails

## Next Steps

1. ✅ Document current token flow and identify issue (THIS FILE)
2. ⏳ Verify if Claude Agent SDK handles decryption internally
3. ⏳ Reverse engineer or document Claude Code CLI decryption mechanism
4. ⏳ Implement `decrypt_token()` function in `apps/backend/core/auth.py`
5. ⏳ Add encryption detection and auto-decryption to `get_auth_token()`
6. ⏳ Test with real encrypted tokens on macOS and Linux
7. ⏳ Add comprehensive error handling for decryption failures

## Open Questions

1. **What encryption algorithm does Claude Code use for `enc:` tokens?**
   - Possible: AES-256, ChaCha20, or similar
   - Key derivation method?

2. **Where is the decryption key stored?**
   - Same keychain entry as encrypted token?
   - Separate keychain entry?
   - Derived from system/user credentials?

3. **Does Claude Agent SDK expect encrypted or decrypted tokens?**
   - If it expects decrypted: we must decrypt before passing
   - If it handles encryption: we may be missing SDK configuration

4. **Is there a Claude Code CLI command to decrypt tokens?**
   - `claude auth decrypt <token>`?
   - `claude auth get-token`?
   - No documented command found in research

5. **Can we reuse Claude Code's decryption mechanism?**
   - Import decryption functions from CLI?
   - Call CLI as subprocess?
   - Implement decryption ourselves?

## References

- Issue: [GitHub #1223: API Error 401](https://github.com/AndyMik90/Auto-Claude/issues/1223)
- Current auth implementation: `apps/backend/core/auth.py`
- SDK client initialization: `apps/backend/core/client.py`
- Requirements: `apps/backend/requirements.txt` (includes `secretstorage>=3.3.3` for Linux)
