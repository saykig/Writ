"""Common adapter output contract; raw source layouts remain source-specific."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class AdapterOutput:
    commitments: tuple[dict[str, Any], ...]
    selections: tuple[dict[str, Any], ...]
    reports: tuple[dict[str, Any], ...]
    member_assessments: tuple[dict[str, Any], ...]
    reconciliations: tuple[dict[str, Any], ...]
    review_items: tuple[dict[str, Any], ...]
    passage_ids: frozenset[str]
    source_document_ids: frozenset[str]


class CorpusAdapter(Protocol):
    """A source adapter never assumes another institution's raw layout."""

    def emit(self) -> AdapterOutput:
        """Return validated candidates without writing normalized files."""
        ...
