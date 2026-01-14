"""
TLDR Hooks Integration
======================

Claude Code hooks for TLDR token efficiency.

Hooks:
- read_enforcer: Intercept large file reads and suggest TLDR
- cache_updater: Update TLDR cache after file modifications
"""

from .read_enforcer import (
    should_use_tldr,
    get_tldr_suggestion,
    process_read_request,
)
from .cache_updater import (
    invalidate_tldr_cache,
    update_tldr_on_edit,
    process_edit_event,
    batch_invalidate,
    batch_regenerate,
)
from .config import TLDRHookConfig
from .setup import (
    setup_tldr_hooks,
    get_hook_status,
    remove_tldr_hooks,
)

__all__ = [
    "TLDRHookConfig",
    "should_use_tldr",
    "get_tldr_suggestion",
    "process_read_request",
    "invalidate_tldr_cache",
    "update_tldr_on_edit",
    "process_edit_event",
    "batch_invalidate",
    "batch_regenerate",
    "setup_tldr_hooks",
    "get_hook_status",
    "remove_tldr_hooks",
]
