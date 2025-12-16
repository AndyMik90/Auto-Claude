"""
Version Manager Commands Module
===============================

Commands for runtime version management tools.
"""

from typing import Dict, Set

# =============================================================================
# VERSION MANAGER COMMANDS
# =============================================================================

VERSION_MANAGER_COMMANDS: Dict[str, Set[str]] = {
    "asdf": {"asdf"},
    "mise": {"mise"},
    "nvm": {"nvm"},
    "fnm": {"fnm"},
    "n": {"n"},
    "pyenv": {"pyenv"},
    "rbenv": {"rbenv"},
    "rvm": {"rvm"},
    "goenv": {"goenv"},
    "rustup": {"rustup"},
    "sdkman": {"sdk"},
    "jabba": {"jabba"},
}


__all__ = ["VERSION_MANAGER_COMMANDS"]
