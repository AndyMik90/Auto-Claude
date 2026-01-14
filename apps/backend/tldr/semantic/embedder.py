"""
TLDR Embedder
=============

Embedding abstraction for TLDR semantic search.
Supports multiple backends: OpenAI, Ollama, or simple TF-IDF fallback.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class EmbedderConfig:
    """Configuration for embedding provider."""

    # Provider: "openai", "ollama", "tfidf" (fallback)
    provider: str = "tfidf"

    # OpenAI settings
    openai_api_key: str | None = None
    openai_model: str = "text-embedding-3-small"

    # Ollama settings
    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "nomic-embed-text"

    # Embedding dimensions (auto-detected for most providers)
    dimensions: int | None = None

    @classmethod
    def from_env(cls) -> EmbedderConfig:
        """Create config from environment variables."""
        provider = os.environ.get("TLDR_EMBEDDER", "tfidf")

        return cls(
            provider=provider,
            openai_api_key=os.environ.get("OPENAI_API_KEY"),
            openai_model=os.environ.get(
                "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
            ),
            ollama_host=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
            ollama_model=os.environ.get("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
        )


class BaseEmbedder(ABC):
    """Abstract base class for embedders."""

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        ...

    @abstractmethod
    def embed(self, text: str) -> np.ndarray:
        """Generate embedding for a single text."""
        ...

    def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        """Generate embeddings for multiple texts."""
        return [self.embed(text) for text in texts]


class TFIDFEmbedder(BaseEmbedder):
    """
    Simple TF-IDF based embedder as fallback.

    Uses hash-based feature extraction for fixed-dimension vectors.
    No external dependencies required.
    """

    def __init__(self, dimensions: int = 256):
        self._dimensions = dimensions
        self._vocab: dict[str, int] = {}

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def _tokenize(self, text: str) -> list[str]:
        """Simple tokenization."""
        import re

        # Convert to lowercase, split on non-alphanumeric
        tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", text.lower())
        return tokens

    def _hash_token(self, token: str) -> int:
        """Hash token to dimension index."""
        h = hashlib.md5(token.encode()).hexdigest()
        return int(h, 16) % self._dimensions

    def embed(self, text: str) -> np.ndarray:
        """Generate TF-IDF-like embedding."""
        tokens = self._tokenize(text)
        if not tokens:
            return np.zeros(self._dimensions)

        # Count token frequencies
        token_counts: dict[int, float] = {}
        for token in tokens:
            idx = self._hash_token(token)
            token_counts[idx] = token_counts.get(idx, 0) + 1

        # Normalize by document length
        total = sum(token_counts.values())
        vector = np.zeros(self._dimensions)
        for idx, count in token_counts.items():
            vector[idx] = count / total

        # L2 normalize
        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        return vector


class OpenAIEmbedder(BaseEmbedder):
    """OpenAI embedding provider."""

    DIMENSION_MAP = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
    }

    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        self.api_key = api_key
        self.model = model
        self._client = None
        self._dimensions = self.DIMENSION_MAP.get(model, 1536)

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def _get_client(self):
        if self._client is None:
            try:
                from openai import OpenAI

                self._client = OpenAI(api_key=self.api_key)
            except ImportError:
                raise ImportError(
                    "OpenAI embedder requires openai package. "
                    "Install with: pip install openai"
                )
        return self._client

    def embed(self, text: str) -> np.ndarray:
        """Generate embedding using OpenAI API."""
        client = self._get_client()

        # Truncate if too long (OpenAI limit is ~8k tokens)
        if len(text) > 30000:
            text = text[:30000]

        response = client.embeddings.create(
            model=self.model,
            input=text,
        )
        return np.array(response.data[0].embedding)

    def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
        """Generate embeddings in batch."""
        client = self._get_client()

        # Truncate long texts
        texts = [t[:30000] if len(t) > 30000 else t for t in texts]

        response = client.embeddings.create(
            model=self.model,
            input=texts,
        )
        return [np.array(item.embedding) for item in response.data]


class OllamaEmbedder(BaseEmbedder):
    """Ollama local embedding provider."""

    DIMENSION_MAP = {
        "nomic-embed-text": 768,
        "mxbai-embed-large": 1024,
        "all-minilm": 384,
        "snowflake-arctic-embed": 1024,
    }

    def __init__(self, host: str = "http://localhost:11434", model: str = "nomic-embed-text"):
        self.host = host.rstrip("/")
        self.model = model
        self._dimensions = self.DIMENSION_MAP.get(model, 768)

    @property
    def dimensions(self) -> int:
        return self._dimensions

    def embed(self, text: str) -> np.ndarray:
        """Generate embedding using Ollama."""
        import urllib.request
        import urllib.error

        url = f"{self.host}/api/embeddings"
        data = json.dumps({"model": self.model, "prompt": text}).encode()

        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read())
                return np.array(result["embedding"])
        except urllib.error.URLError as e:
            logger.warning(f"Ollama request failed: {e}")
            raise ConnectionError(f"Failed to connect to Ollama at {self.host}: {e}")


def get_embedder(config: EmbedderConfig | None = None) -> BaseEmbedder:
    """
    Get an embedder instance based on configuration.

    Falls back to TF-IDF if configured provider is unavailable.

    Args:
        config: Embedder configuration (uses environment if not provided)

    Returns:
        Embedder instance
    """
    if config is None:
        config = EmbedderConfig.from_env()

    # Try configured provider
    if config.provider == "openai":
        if config.openai_api_key:
            try:
                return OpenAIEmbedder(
                    api_key=config.openai_api_key,
                    model=config.openai_model,
                )
            except ImportError as e:
                logger.warning(f"OpenAI embedder unavailable: {e}")
        else:
            logger.warning("OpenAI embedder requires OPENAI_API_KEY")

    elif config.provider == "ollama":
        try:
            embedder = OllamaEmbedder(
                host=config.ollama_host,
                model=config.ollama_model,
            )
            # Test connection
            embedder.embed("test")
            return embedder
        except (ConnectionError, Exception) as e:
            logger.warning(f"Ollama embedder unavailable: {e}")

    # Fallback to TF-IDF
    logger.info("Using TF-IDF fallback embedder")
    return TFIDFEmbedder(dimensions=config.dimensions or 256)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(dot / (norm_a * norm_b))
