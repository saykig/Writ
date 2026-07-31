"""Governed corpus ingestion and migration primitives."""

from .eu_us_ai_governance import (
    build_corpus_documents,
    validate_active_corpora,
    write_corpus_documents,
)
from .models import PublishedComplianceResult, WritComputedResult
from .registry import get_source, load_registry

__all__ = [
    "PublishedComplianceResult",
    "WritComputedResult",
    "build_corpus_documents",
    "get_source",
    "load_registry",
    "validate_active_corpora",
    "write_corpus_documents",
]
