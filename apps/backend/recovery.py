"""Backward compatibility shim - import from services.recovery instead."""

from importlib import util
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from services.recovery import (  # noqa: E402
        FailureType,
        RecoveryAction,
        RecoveryManager,
        check_and_recover,
        get_recovery_context,
    )
except ModuleNotFoundError:
    services_path = backend_dir / "services" / "recovery.py"
    spec = util.spec_from_file_location("services.recovery", services_path)
    if spec is None or spec.loader is None:
        raise
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    FailureType = module.FailureType
    RecoveryAction = module.RecoveryAction
    RecoveryManager = module.RecoveryManager
    check_and_recover = module.check_and_recover
    get_recovery_context = module.get_recovery_context

__all__ = [
    "RecoveryManager",
    "FailureType",
    "RecoveryAction",
    "check_and_recover",
    "get_recovery_context",
]
