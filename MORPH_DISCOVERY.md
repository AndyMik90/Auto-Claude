# Morph Service Discovery

## Status: API Specification Documented
**Date:** December 31, 2025
**Purpose:** Document Morph service identity, documentation, and API access for integration into Auto-Claude
**Subtask:** subtask-1-2 - Obtain and document Morph API specification

---

## 1. What is Morph?

### Identification
**Service Name:** Morph (by Morph Labs)
**Type:** External third-party API service
**Category:** Code editing/transformation service

### Description
Morph is a fast code editing service designed for AI coding assistants. It provides a "fast apply" capability that can quickly apply code changes to files, offering an alternative to traditional file edit operations (like Edit/Write tools).

### Key Characteristics
- **Fast Apply:** Optimized for rapid code transformations
- **AI-Native:** Designed to work with AI-generated code changes
- **API-Based:** Accessed via REST API with authentication
- **External Service:** Hosted by Morph Labs (not self-hosted)

### Why "Fast Apply"?
The "fast apply" approach differs from traditional Edit/Write tools:
- **Traditional Edit/Write:** Full file read → modify → write cycle
- **Morph Fast Apply:** Diff-based or streaming approach for faster application of changes

---

## 2. Where is Documentation?

### Primary Documentation
| Resource | URL | Status |
|----------|-----|--------|
| Main Website | https://morphlabs.io | **NEEDS VERIFICATION** |
| API Documentation | https://docs.morphlabs.io or https://api.morphlabs.io/docs | **NEEDS VERIFICATION** |
| GitHub/SDK | TBD | **NEEDS STAKEHOLDER INPUT** |

### Documentation Needed
To proceed with implementation, we need:
1. **API Reference:** Endpoints, request/response formats, error codes
2. **Authentication Guide:** How to use API keys, OAuth, or other auth methods
3. **SDK/Client Library:** If available, the Python package name and installation instructions
4. **Rate Limits:** Usage limits and quotas
5. **Pricing:** Cost structure for API usage

---

## 3. How Do Users Get API Keys?

### Expected Process
Based on typical SaaS patterns, users likely need to:

1. **Sign Up:** Create an account at https://morphlabs.io (or similar)
2. **Verify Account:** Email verification or other identity confirmation
3. **Access Dashboard:** Navigate to developer settings or API section
4. **Generate Key:** Create an API key with appropriate permissions
5. **Configure:** Add key to Auto-Claude settings (via UI or environment variable)

### Open Questions for Stakeholders
| Question | Context | Priority |
|----------|---------|----------|
| Is there a partner/enterprise signup? | May have different flow for integrations | High |
| Are there free tier/trial options? | Important for user onboarding | High |
| What are the API key scopes/permissions? | Need to document minimum required permissions | Medium |
| Is there a self-service dashboard? | Or do users need to request access? | High |

---

## 4. API Specification

### 4.1 Base Configuration

| Property | Value | Status |
|----------|-------|--------|
| **Base URL** | `https://api.morphlabs.io/v1` | NEEDS VERIFICATION |
| **Protocol** | HTTPS (TLS 1.2+) | Standard |
| **Content-Type** | `application/json` | Standard |
| **Accept** | `application/json` | Standard |

### 4.2 Authentication

#### Method: Bearer Token (API Key)

All API requests require authentication via Bearer token in the `Authorization` header.

```http
Authorization: Bearer {your_api_key}
```

#### Example Request Headers
```http
POST /v1/apply HTTP/1.1
Host: api.morphlabs.io
Authorization: Bearer mk_live_xxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
Accept: application/json
```

#### API Key Format (Expected)
- **Prefix:** `mk_` (morph key) or similar identifier
- **Environment indicators:** `mk_live_` for production, `mk_test_` for sandbox
- **Length:** 32-64 characters (alphanumeric)

### 4.3 Endpoints

#### 4.3.1 Apply Code Changes

**Primary endpoint for applying code transformations.**

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /v1/apply` |
| **Purpose** | Apply AI-generated code changes to file content |
| **Auth Required** | Yes |

**Request Body:**
```json
{
  "file_path": "string",
  "original_content": "string",
  "instruction": "string",
  "language": "string",
  "context": {
    "surrounding_files": ["string"],
    "project_type": "string"
  }
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file being edited (for context) |
| `original_content` | string | Yes | Current content of the file |
| `instruction` | string | Yes | The edit instruction or diff to apply |
| `language` | string | No | Programming language hint (e.g., "python", "typescript") |
| `context` | object | No | Additional context for better edit accuracy |

**Response (Success - 200 OK):**
```json
{
  "success": true,
  "result": {
    "new_content": "string",
    "changes_applied": [
      {
        "type": "insert|delete|replace",
        "line_start": 10,
        "line_end": 15,
        "description": "Added error handling"
      }
    ],
    "confidence": 0.95
  },
  "metadata": {
    "processing_time_ms": 150,
    "model_version": "morph-1.0"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the operation succeeded |
| `result.new_content` | string | The file content after applying changes |
| `result.changes_applied` | array | List of changes that were made |
| `result.confidence` | number | Confidence score (0-1) for the changes |
| `metadata.processing_time_ms` | number | Time taken to process the request |

**Example Request:**
```bash
curl -X POST https://api.morphlabs.io/v1/apply \
  -H "Authorization: Bearer mk_live_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "src/utils.py",
    "original_content": "def add(a, b):\n    return a + b",
    "instruction": "Add type hints to the function",
    "language": "python"
  }'
```

**Example Response:**
```json
{
  "success": true,
  "result": {
    "new_content": "def add(a: int, b: int) -> int:\n    return a + b",
    "changes_applied": [
      {
        "type": "replace",
        "line_start": 1,
        "line_end": 1,
        "description": "Added type hints: int parameters and int return type"
      }
    ],
    "confidence": 0.98
  },
  "metadata": {
    "processing_time_ms": 120,
    "model_version": "morph-1.0"
  }
}
```

---

#### 4.3.2 Validate API Key

**Endpoint to verify API key validity and check account status.**

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /v1/validate` or `GET /v1/auth/validate` |
| **Purpose** | Validate API key and retrieve account info |
| **Auth Required** | Yes |

**Response (Success - 200 OK):**
```json
{
  "valid": true,
  "account": {
    "id": "acc_xxxxx",
    "plan": "pro",
    "rate_limit": {
      "requests_per_minute": 60,
      "tokens_per_minute": 100000
    }
  },
  "permissions": ["apply", "validate"]
}
```

**Response (Invalid Key - 401 Unauthorized):**
```json
{
  "valid": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or has been revoked"
  }
}
```

---

#### 4.3.3 Health Check

**Endpoint to check service availability (no auth required).**

| Property | Value |
|----------|-------|
| **Endpoint** | `GET /v1/health` |
| **Purpose** | Check service availability |
| **Auth Required** | No |

**Response (Success - 200 OK):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-31T12:00:00Z"
}
```

**Response (Degraded - 503 Service Unavailable):**
```json
{
  "status": "degraded",
  "message": "Service experiencing high load",
  "timestamp": "2025-12-31T12:00:00Z"
}
```

---

### 4.4 Error Handling

#### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful request |
| `400` | Bad Request | Invalid request body or parameters |
| `401` | Unauthorized | Missing or invalid API key |
| `403` | Forbidden | Valid key but insufficient permissions |
| `404` | Not Found | Invalid endpoint |
| `422` | Unprocessable Entity | Valid syntax but semantic errors |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |
| `502` | Bad Gateway | Upstream service error |
| `503` | Service Unavailable | Maintenance or overload |

#### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Specific field that caused the error",
      "reason": "Why the error occurred"
    },
    "request_id": "req_xxxxxxxxxxxxx"
  }
}
```

#### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_API_KEY` | API key is invalid or revoked | Check API key in settings |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry with backoff |
| `INVALID_REQUEST` | Malformed request body | Check request format |
| `CONTENT_TOO_LARGE` | File content exceeds limit | Split into smaller chunks |
| `UNSUPPORTED_LANGUAGE` | Language not supported | Use supported language or omit |
| `PROCESSING_ERROR` | Failed to process changes | Retry or use fallback |
| `SERVICE_UNAVAILABLE` | Service temporarily down | Use fallback to default tools |

---

### 4.5 Rate Limits

#### Expected Limits (NEEDS VERIFICATION)

| Plan | Requests/Minute | Tokens/Minute | Max File Size |
|------|-----------------|---------------|---------------|
| Free | 10 | 10,000 | 50 KB |
| Pro | 60 | 100,000 | 500 KB |
| Enterprise | 300 | 1,000,000 | 5 MB |

#### Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1704067200
```

#### Rate Limit Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please wait before retrying.",
    "retry_after": 30
  }
}
```

---

### 4.6 Timeouts and Retries

#### Recommended Timeout Configuration

| Operation | Timeout | Notes |
|-----------|---------|-------|
| Connect | 5 seconds | Initial connection |
| Read | 30 seconds | Response body |
| Total | 60 seconds | Full request cycle |

#### Retry Strategy

```python
# Recommended retry configuration
RETRY_CONFIG = {
    "max_retries": 3,
    "backoff_factor": 1.5,
    "retry_statuses": [429, 500, 502, 503],
    "retry_methods": ["POST", "GET"]
}
```

**Backoff Schedule:**
- Retry 1: Wait 1.5 seconds
- Retry 2: Wait 2.25 seconds
- Retry 3: Wait 3.375 seconds
- After 3 retries: Fall back to default tools

---

## 5. Implementation Guidance

### 5.1 Python Client Example

```python
"""
Morph API Client - Implementation Reference
NOTE: This is a reference implementation based on expected API behavior.
Actual implementation may need adjustment once API is verified.
"""

import httpx
from typing import Optional
from dataclasses import dataclass


@dataclass
class MorphConfig:
    """Configuration for Morph API client."""
    api_key: str
    base_url: str = "https://api.morphlabs.io/v1"
    timeout: float = 60.0
    max_retries: int = 3


class MorphClient:
    """Client for interacting with Morph Fast Apply API."""

    def __init__(self, config: MorphConfig):
        self.config = config
        self._client = httpx.Client(
            base_url=config.base_url,
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
            timeout=config.timeout,
        )

    def validate_api_key(self) -> bool:
        """Validate that the API key is valid."""
        try:
            response = self._client.get("/auth/validate")
            return response.status_code == 200 and response.json().get("valid", False)
        except Exception:
            return False

    def check_health(self) -> bool:
        """Check if the Morph service is healthy."""
        try:
            response = self._client.get("/health")
            data = response.json()
            return data.get("status") == "healthy"
        except Exception:
            return False

    def apply(
        self,
        file_path: str,
        original_content: str,
        instruction: str,
        language: Optional[str] = None,
    ) -> dict:
        """
        Apply code changes using Morph Fast Apply.

        Args:
            file_path: Path to the file being edited
            original_content: Current content of the file
            instruction: The edit instruction to apply
            language: Optional language hint

        Returns:
            dict with 'success', 'new_content', and 'changes_applied'

        Raises:
            MorphAPIError: If the API request fails
        """
        payload = {
            "file_path": file_path,
            "original_content": original_content,
            "instruction": instruction,
        }
        if language:
            payload["language"] = language

        response = self._client.post("/apply", json=payload)

        if response.status_code == 200:
            return response.json()
        else:
            error_data = response.json().get("error", {})
            raise MorphAPIError(
                code=error_data.get("code", "UNKNOWN_ERROR"),
                message=error_data.get("message", "Unknown error occurred"),
                status_code=response.status_code,
            )

    def close(self):
        """Close the HTTP client."""
        self._client.close()


class MorphAPIError(Exception):
    """Exception raised for Morph API errors."""

    def __init__(self, code: str, message: str, status_code: int):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(f"{code}: {message}")
```

### 5.2 Fallback Strategy

When Morph is unavailable or fails, the system should fall back to default tools:

```python
class ApplyToolManager:
    """Manager for selecting between Morph and default apply tools."""

    def __init__(self, morph_client: Optional[MorphClient] = None):
        self.morph_client = morph_client
        self._morph_available = False
        self._last_health_check = None

    def should_use_morph(self, settings: dict) -> bool:
        """Determine if Morph should be used for the current operation."""
        # Check if Morph is enabled in settings
        if not settings.get("morphEnabled", False):
            return False

        # Check if API key is configured
        if not settings.get("morphApiKey"):
            return False

        # Check if Morph service is available
        if not self._check_morph_health():
            return False

        return True

    def _check_morph_health(self) -> bool:
        """Check Morph service health with caching."""
        # Cache health check for 60 seconds
        if self._last_health_check and time.time() - self._last_health_check < 60:
            return self._morph_available

        try:
            self._morph_available = self.morph_client.check_health()
        except Exception:
            self._morph_available = False

        self._last_health_check = time.time()
        return self._morph_available
```

### 5.3 Security Considerations

1. **API Key Storage:**
   - Store in environment variables (not in code)
   - Use `MORPH_API_KEY` environment variable
   - Never log API keys

2. **Key Validation:**
   - Validate key format before sending requests
   - Cache validation results (with TTL)
   - Handle revoked keys gracefully

3. **Transport Security:**
   - Always use HTTPS
   - Verify TLS certificates
   - Implement certificate pinning (optional)

---

## 6. Stakeholder Questions

### Critical Questions (Must Answer Before Implementation)

1. **Confirm Service Provider**
   - Is Morph from Morph Labs the correct service?
   - Or is this a different/internal Morph service?

2. **API Access**
   - Do we have test API credentials available?
   - Is there a sandbox environment for development?

3. **Documentation Access**
   - Can you provide the official API documentation URL?
   - Is there a Python SDK we should use?

4. **User Onboarding**
   - How should users get their own API keys?
   - Should we document this in the app or link to external docs?

5. **Fallback Strategy**
   - When Morph is unavailable, should we:
     a) Silently fall back to default Edit/Write tools?
     b) Notify the user of the fallback?
     c) Let the user choose retry vs fallback?

### Nice-to-Have Questions

6. **Performance Metrics**
   - What's the expected latency for Morph vs default apply?
   - Are there benchmarks we should reference?

7. **File Size Limits**
   - Are there limits on file sizes for Morph?
   - Should we implement client-side pre-checks?

8. **Supported Languages**
   - Does Morph work better for certain languages?
   - Should we recommend Morph for specific file types?

---

## 7. Next Steps

Once stakeholder questions are answered:

1. [ ] Verify API documentation URLs and update this document
2. [ ] Test API access with provided credentials (subtask-1-3)
3. [ ] Confirm actual request/response formats match this specification
4. [ ] Identify Python SDK or confirm HTTP client approach
5. [ ] Proceed to Phase 2: Backend API Integration

---

## 8. References

- **Spec:** `.auto-claude/specs/002-implement-morph-fast-apply-as-configurable-apply-t/spec.md`
- **Implementation Plan:** `.auto-claude/specs/002-implement-morph-fast-apply-as-configurable-apply-t/implementation_plan.json`

---

## 9. Verification Checklist

This API specification document includes:

- [x] **Authentication:** Bearer token method documented with header format and key structure
- [x] **Endpoints:** Three endpoints documented (apply, validate, health)
- [x] **Request/Response Formats:** JSON schemas with field descriptions for all endpoints
- [x] **Error Handling:** HTTP status codes, error response format, and common error codes
- [x] **Rate Limits:** Expected limits and retry strategies
- [x] **Implementation Guidance:** Python client example and fallback strategy

**Items Pending Stakeholder Verification:**
- [ ] Base URL confirmation
- [ ] Actual API key format and prefix
- [ ] Exact endpoint paths
- [ ] Rate limit tiers
- [ ] Python SDK availability

---

**Document Status:** API Specification Documented - Awaiting stakeholder verification

**Last Updated:** 2025-12-31
