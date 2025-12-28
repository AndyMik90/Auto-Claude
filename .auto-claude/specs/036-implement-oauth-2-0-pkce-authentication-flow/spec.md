# Specification: Implement OAuth 2.0 + PKCE Authentication Flow

## Overview

Implement a custom OAuth 2.0 + PKCE (Proof Key for Code Exchange) authentication flow for Claude profiles to enable access to the `/usage` endpoint. The current `claude setup-token` command only requests the `user:inference` scope, which blocks access to usage data that requires the `user:profile` scope. This implementation follows the proven approach used by OpenCode, utilizing Anthropic's pre-whitelisted redirect URI (`http://127.0.0.1:8487/oauth/callback`) to avoid custom OAuth app registration while requesting all required scopes (`org:createapikey`, `user:profile`, `user:inference`).

## Workflow Type

**Type**: feature

**Rationale**: This is a new feature implementation that adds OAuth 2.0 + PKCE authentication capability. It requires creating new modules, integrating with existing authentication infrastructure, and adding a complete OAuth flow with local callback server.

## Task Scope

### Services Involved
- **backend** (primary) - New OAuth module and integration with existing auth system
- **frontend** (integration) - May need UI components for auth status/flow initiation in future

### This Task Will:
- [ ] Create new OAuth 2.0 client module with PKCE support using Authlib
- [ ] Implement local callback server on port 8487 for OAuth redirect handling
- [ ] Add token storage integration with existing macOS Keychain pattern
- [ ] Extend scope from just `user:inference` to include `user:profile` and `org:createapikey`
- [ ] Enable `/usage` endpoint access through proper OAuth scope configuration
- [ ] Add CLI command or hook to initiate the enhanced OAuth flow

### Out of Scope:
- Custom OAuth application registration with Anthropic (using pre-whitelisted URI)
- Cross-platform token storage (Windows/Linux) - macOS Keychain only initially
- Usage endpoint UI/frontend implementation
- Modifying existing `claude setup-token` behavior (extend, not replace)

## Service Context

### Backend

**Tech Stack:**
- Language: Python
- Framework: None (vanilla Python with CLI)
- Key directories: `core/`, `cli/`, `services/`

**Entry Point:** `apps/backend/run.py`

**How to Run:**
```bash
cd apps/backend
python run.py --help
```

**Port:** N/A (CLI tool, but OAuth callback uses port 8487)

**Relevant Files:**
- `apps/backend/core/auth.py` - Existing authentication helpers
- `apps/backend/cli/main.py` - CLI entry point

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `apps/backend/core/auth.py` | backend | Add token storage with extended scopes support |
| `apps/backend/cli/main.py` | backend | Potentially add OAuth flow command |
| `apps/backend/requirements.txt` or `pyproject.toml` | backend | Add Authlib>=1.3.0 dependency |

## Files to Create

| File | Service | Purpose |
|------|---------|---------|
| `apps/backend/core/oauth.py` | backend | OAuth 2.0 + PKCE flow implementation |
| `apps/backend/core/oauth_server.py` | backend | Local HTTP callback server for OAuth redirect |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `apps/backend/core/auth.py` | Keychain integration, token validation, error handling patterns |

## Patterns to Follow

### Keychain Token Storage Pattern

From `apps/backend/core/auth.py`:

```python
def get_token_from_keychain() -> str | None:
    """Get authentication token from macOS Keychain."""
    if platform.system() != "Darwin":
        return None

    try:
        result = subprocess.run(
            [
                "/usr/bin/security",
                "find-generic-password",
                "-s",
                "Claude Code-credentials",
                "-w",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            return None

        credentials_json = result.stdout.strip()
        data = json.loads(credentials_json)
        token = data.get("claudeAiOauth", {}).get("accessToken")

        if token and token.startswith("sk-ant-oat01-"):
            return token
        return None
    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, Exception):
        return None
```

**Key Points:**
- Service name: `"Claude Code-credentials"`
- JSON structure: `{"claudeAiOauth": {"accessToken": "sk-ant-oat01-..."}}`
- Token prefix validation: `sk-ant-oat01-`
- Platform check for macOS only

### OAuth 2.0 + PKCE Pattern (Authlib)

```python
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from authlib.integrations.httpx_client import OAuth2Client
from secrets import token_urlsafe

# Generate PKCE verifier and challenge
code_verifier = token_urlsafe(48)
code_challenge = create_s256_code_challenge(code_verifier)

# Create OAuth client (public client - no secret)
client = OAuth2Client(
    client_id="claude-code",  # Anthropic's pre-registered client
    token_endpoint_auth_method="none",
)

# Create authorization URL with PKCE
auth_url = client.create_authorization_url(
    "https://console.anthropic.com/oauth/authorize",
    redirect_uri="http://127.0.0.1:8487/oauth/callback",
    scope="org:createapikey user:profile user:inference",
    code_challenge=code_challenge,
    code_challenge_method="S256",
)

# After callback, exchange code for token
token = client.fetch_token(
    "https://console.anthropic.com/oauth/token",
    authorization_response=callback_url,
    code_verifier=code_verifier,
)
```

**Key Points:**
- Must pass `code_verifier` to both `create_authorization_url()` AND `fetch_token()`
- Use `token_endpoint_auth_method='none'` for public client
- Port 8487 is hardcoded (Anthropic's whitelist)
- S256 code challenge method required

## Requirements

### Functional Requirements

1. **OAuth Flow Initiation**
   - Description: User can initiate OAuth authentication flow
   - Acceptance: CLI command or function starts OAuth flow, opens browser

2. **PKCE Implementation**
   - Description: Use PKCE for enhanced security without client secrets
   - Acceptance: Code verifier/challenge generated correctly, S256 method used

3. **Local Callback Server**
   - Description: HTTP server on port 8487 handles OAuth callback
   - Acceptance: Server starts, receives callback, extracts authorization code, shuts down

4. **Token Exchange**
   - Description: Exchange authorization code for access token
   - Acceptance: Token obtained with all requested scopes

5. **Token Storage**
   - Description: Store token in macOS Keychain using existing pattern
   - Acceptance: Token retrievable via `get_token_from_keychain()`

6. **Extended Scopes**
   - Description: Request all necessary scopes for `/usage` endpoint
   - Acceptance: Token includes `user:profile` scope

### Edge Cases

1. **Port 8487 Already in Use** - Detect and show clear error message
2. **User Cancels OAuth Flow** - Handle timeout or denial gracefully
3. **Network Errors** - Retry logic or clear error messaging
4. **Invalid Token Response** - Validate token format before storage
5. **Existing Token** - Decide whether to replace or prompt user

## Implementation Notes

### DO
- Follow the Keychain pattern in `apps/backend/core/auth.py` for token storage
- Use Authlib for OAuth 2.0 client with PKCE support
- Bind callback server to `127.0.0.1` only (not `0.0.0.0`)
- Thread the HTTP server for non-blocking operation
- Handle single callback request then shut down server
- Validate token format before storing (`sk-ant-oat01-` prefix)

### DON'T
- Create new OAuth application registration with Anthropic
- Use client secrets (public client pattern only)
- Bind to ports other than 8487
- Store tokens in plaintext files
- Block main thread while waiting for callback
- Leave callback server running after token exchange

## OAuth Configuration

### Endpoints (from OpenCode reference)

| Endpoint | URL |
|----------|-----|
| Authorization | `https://console.anthropic.com/oauth/authorize` |
| Token | `https://console.anthropic.com/oauth/token` |
| Redirect URI | `http://127.0.0.1:8487/oauth/callback` |

### Scopes

| Scope | Purpose |
|-------|---------|
| `org:createapikey` | API key creation |
| `user:profile` | Access to usage data (enables `/usage` endpoint) |
| `user:inference` | Inference capabilities |

### Client Configuration

- **Client ID**: Pre-registered by Anthropic (from OpenCode pattern)
- **Client Secret**: None (public client)
- **Auth Method**: `none` (PKCE replaces secret)
- **Code Challenge Method**: `S256`

## Development Environment

### Start Services

```bash
# Backend (CLI tool - no server needed)
cd apps/backend
python run.py --help
```

### Service URLs
- OAuth Callback: http://127.0.0.1:8487/oauth/callback (local, temporary)

### Required Environment Variables
- `CLAUDE_CODE_OAUTH_TOKEN`: OAuth token from Claude Code (will be set after authentication)

### Required Dependencies
- `Authlib>=1.3.0`: OAuth 2.0 client with PKCE support
- `httpx`: HTTP client (likely already available via anthropic SDK)

## Success Criteria

The task is complete when:

1. [ ] OAuth 2.0 + PKCE flow successfully authenticates with Anthropic
2. [ ] Token includes `user:profile` scope (enables `/usage` endpoint)
3. [ ] Token stored in macOS Keychain using existing pattern
4. [ ] Token retrievable via existing `get_token_from_keychain()` function
5. [ ] No console errors during OAuth flow
6. [ ] Existing authentication tests still pass
7. [ ] New functionality verified via CLI and API access

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| PKCE Generation | `apps/backend/core/test_oauth.py` | Code verifier/challenge generation is correct |
| Token Validation | `apps/backend/core/test_oauth.py` | Token format validation works |
| Keychain Storage | `apps/backend/core/test_auth.py` | Token storage/retrieval works |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| OAuth Flow | backend ↔ Anthropic | Full OAuth flow completes successfully |
| Token Usage | backend ↔ Anthropic API | Token with new scopes can access `/usage` |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Full OAuth Flow | 1. Initiate OAuth 2. Authorize in browser 3. Callback received 4. Token stored | Token in Keychain, accessible via `get_auth_token()` |
| Usage Endpoint Access | 1. Authenticate 2. Call `/usage` endpoint | Successful response with usage data |

### Browser Verification (if frontend)
| Page/Component | URL | Checks |
|----------------|-----|--------|
| OAuth Authorization | Anthropic Console | Scope consent screen shows all 3 scopes |

### Database Verification (if applicable)
N/A - Token stored in macOS Keychain, not database

### Manual Verification Steps
| Step | Command/Action | Expected Result |
|------|----------------|-----------------|
| Keychain Check | `/usr/bin/security find-generic-password -s "Claude Code-credentials" -w` | Returns JSON with `claudeAiOauth.accessToken` |
| Token Format | Parse token from Keychain | Starts with `sk-ant-oat01-` |
| Port Availability | `lsof -i :8487` | Empty (port available before OAuth) |

### QA Sign-off Requirements
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Browser verification complete (OAuth consent shows 3 scopes)
- [ ] Keychain state verified (token stored correctly)
- [ ] No regressions in existing functionality
- [ ] Code follows established patterns in `core/auth.py`
- [ ] No security vulnerabilities introduced (PKCE properly implemented)
- [ ] Port 8487 properly released after OAuth flow
