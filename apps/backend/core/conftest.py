"""
Pytest configuration for core module tests.

Adds the backend directory to sys.path for proper imports.
"""

import sys
from pathlib import Path

# Add parent directory (apps/backend) to path for imports
backend_path = Path(__file__).parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))
