"""Generic governed corpus-ingestion primitives."""

from .registry import get_source, load_registry

__all__ = [
    "get_source",
    "load_registry",
]
