"""
Graph database client wrapper for Graphiti memory.

Handles database connection, initialization, and lifecycle management.
Uses LadybugDB as the embedded graph database (no Docker required, Python 3.12+).
"""

import asyncio
import logging
import sys
from datetime import datetime, timezone

from graphiti_config import GraphitiConfig, GraphitiState

logger = logging.getLogger(__name__)


def _apply_ladybug_monkeypatch() -> bool:
    """
    Apply monkeypatch to use LadybugDB as Kuzu replacement, or use native kuzu.

    LadybugDB is a fork of Kuzu that provides an embedded graph database.
    Since graphiti-core has a KuzuDriver, we can use LadybugDB by making
    the 'kuzu' import point to 'real_ladybug'.

    Falls back to native kuzu if LadybugDB is not available.

    Returns:
        True if kuzu (or monkeypatch) is available
    """
    # First try LadybugDB monkeypatch
    try:
        import real_ladybug

        sys.modules["kuzu"] = real_ladybug
        logger.info("Applied LadybugDB monkeypatch (kuzu -> real_ladybug)")
        return True
    except ImportError:
        pass

    # Fall back to native kuzu
    try:
        import kuzu  # noqa: F401

        logger.info("Using native kuzu (LadybugDB not installed)")
        return True
    except ImportError:
        logger.warning(
            "Neither LadybugDB nor kuzu installed. "
            "Install with: pip install real_ladybug (requires Python 3.12+) or pip install kuzu"
        )
        return False


class GraphitiClient:
    """
    Manages the Graphiti client lifecycle and database connection.

    Handles lazy initialization, provider setup, and connection management.
    Uses LadybugDB as the embedded graph database.
    """

    def __init__(self, config: GraphitiConfig):
        """
        Initialize the client manager.

        Args:
            config: Graphiti configuration
        """
        self.config = config
        self._graphiti = None
        self._driver = None
        self._llm_client = None
        self._embedder = None
        self._initialized = False
        # Guards against concurrent initialize() calls racing and doing duplicate work.
        self._init_lock = asyncio.Lock()

    @property
    def graphiti(self):
        """Get the Graphiti instance (must be initialized first)."""
        return self._graphiti

    @property
    def is_initialized(self) -> bool:
        """Check if client is initialized."""
        return self._initialized

    async def _initialize_unlocked(self, state: GraphitiState | None = None) -> bool:
        """
        Initialize the Graphiti client with configured providers (caller must synchronize).

        Args:
            state: Optional GraphitiState for tracking initialization status

        Returns:
            True if initialization succeeded
        """
        try:
            # Import Graphiti core
            from graphiti_core import Graphiti
            from graphiti_core.cross_encoder.client import CrossEncoderClient

            # Import our provider factory
            from graphiti_providers import (
                ProviderError,
                ProviderNotInstalled,
                create_embedder,
                create_llm_client,
            )

            # Create providers using factory pattern
            try:
                self._llm_client = create_llm_client(self.config)
                logger.info(
                    f"Created LLM client for provider: {self.config.llm_provider}"
                )
            except ProviderNotInstalled as e:
                logger.warning(f"LLM provider packages not installed: {e}")
                return False
            except ProviderError as e:
                logger.warning(f"LLM provider configuration error: {e}")
                return False

            try:
                self._embedder = create_embedder(self.config)
                logger.info(
                    f"Created embedder for provider: {self.config.embedder_provider}"
                )
            except ProviderNotInstalled as e:
                logger.warning(f"Embedder provider packages not installed: {e}")
                return False
            except ProviderError as e:
                logger.warning(f"Embedder provider configuration error: {e}")
                return False

            # graphiti-core defaults to OpenAI's reranker when cross_encoder=None,
            # which hard-requires an OpenAI API key. If the user isn't using OpenAI,
            # pass a safe no-op cross-encoder to prevent accidental OpenAI init.
            cross_encoder = None
            llm_provider = (self.config.llm_provider or "").lower()
            embedder_provider = (self.config.embedder_provider or "").lower()
            if llm_provider != "openai" and embedder_provider != "openai":
                class _NoOpCrossEncoder(CrossEncoderClient):
                    async def rank(
                        self, query: str, passages: list[str]
                    ) -> list[tuple[str, float]]:
                        # Keep ordering stable; assign equal scores.
                        return [(p, 1.0) for p in passages]

                cross_encoder = _NoOpCrossEncoder()

            # Apply LadybugDB monkeypatch to use it via graphiti's KuzuDriver
            if not _apply_ladybug_monkeypatch():
                logger.error(
                    "LadybugDB is required for Graphiti memory. "
                    "Install with: pip install real_ladybug (requires Python 3.12+)"
                )
                return False

            try:
                # Use our patched KuzuDriver that properly creates FTS indexes
                # The original graphiti-core KuzuDriver has build_indices_and_constraints()
                # as a no-op, which causes FTS search failures
                from integrations.graphiti.queries_pkg.kuzu_driver_patched import (
                    create_patched_kuzu_driver,
                )

                db_path = self.config.get_db_path()
                try:
                    self._driver = create_patched_kuzu_driver(db=str(db_path))
                except (OSError, PermissionError) as e:
                    logger.warning(
                        f"Failed to initialize LadybugDB driver at {db_path}: {e}"
                    )
                    return False
                except Exception as e:
                    logger.warning(
                        f"Unexpected error initializing LadybugDB driver at {db_path}: {e}"
                    )
                    return False
                logger.info(f"Initialized LadybugDB driver (patched) at: {db_path}")
            except ImportError as e:
                logger.warning(f"KuzuDriver not available: {e}")
                return False

            # Initialize Graphiti with the custom providers
            self._graphiti = Graphiti(
                graph_driver=self._driver,
                llm_client=self._llm_client,
                embedder=self._embedder,
                cross_encoder=cross_encoder,
            )

            # Build indices and constraints.
            #
            # Even if our per-spec state says indices were built, the underlying DB
            # may have been deleted/recreated (common in dev) which would make FTS
            # indexes missing and break saves/searches with Binder errors.
            # The operation is designed to be idempotent (or to skip "already exists"),
            # so we run it unconditionally for robustness.
            logger.info("Ensuring Graphiti indices and constraints exist...")
            await self._graphiti.build_indices_and_constraints()

            if state:
                state.indices_built = True
                state.initialized = True
                state.database = self.config.database
                state.created_at = datetime.now(timezone.utc).isoformat()
                state.llm_provider = self.config.llm_provider
                state.embedder_provider = self.config.embedder_provider

            self._initialized = True
            logger.info(
                f"Graphiti client initialized "
                f"(providers: {self.config.get_provider_summary()})"
            )
            return True

        except ImportError as e:
            logger.warning(
                f"Graphiti packages not installed: {e}. "
                "Install with: pip install real_ladybug graphiti-core"
            )
            return False

        except Exception as e:
            logger.warning(f"Failed to initialize Graphiti client: {e}")
            return False

    async def initialize(self, state: GraphitiState | None = None) -> bool:
        """
        Initialize the Graphiti client with configured providers.

        This method is concurrency-safe: concurrent callers will synchronize so that
        initialization runs at most once.

        Args:
            state: Optional GraphitiState for tracking initialization status

        Returns:
            True if initialization succeeded
        """
        # Fast-path: common case when already initialized.
        if self._initialized:
            return True

        async with self._init_lock:
            # Double-check after acquiring lock (another task may have initialized).
            if self._initialized:
                return True
            return await self._initialize_unlocked(state)

    async def close(self) -> None:
        """
        Close the Graphiti client and clean up connections.
        """
        if self._graphiti:
            try:
                await self._graphiti.close()
                logger.info("Graphiti connection closed")
            except Exception as e:
                logger.warning(f"Error closing Graphiti: {e}")
            finally:
                self._graphiti = None
                self._driver = None
                self._llm_client = None
                self._embedder = None
                self._initialized = False
