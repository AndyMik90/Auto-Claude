# Gotchas & Pitfalls

Things to watch out for in this codebase.

## [2025-12-28 00:28]
Spec references apps/backend/ but actual project structure is auto-claude/. All paths in subtasks referencing apps/backend/ should use auto-claude/ instead (e.g., apps/backend/core/oauth.py → auto-claude/core/oauth.py)

_Context: Implementation plan subtask-1-1 and spec for OAuth 2.0 + PKCE feature_
