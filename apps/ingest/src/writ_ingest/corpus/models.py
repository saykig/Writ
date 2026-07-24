"""Closed corpus value types and semantic guards."""

from __future__ import annotations

from typing import Any, Literal

HISTORICAL_LABEL_TYPE = "expert_assigned_historical_score"

type PublishedComplianceResult = Literal["-1", "0", "+1", "not_applicable"] | None
type WritComputedResult = Literal["-1", "0", "+1", "not_applicable", "unresolved"]
type SelectionStatus = Literal["selected", "not_selected", "unknown"]
type ReportStage = Literal["preliminary", "interim", "final", "special"]

PUBLISHED_RESULTS = frozenset({"-1", "0", "+1", "not_applicable"})
WRIT_RESULTS = frozenset({*PUBLISHED_RESULTS, "unresolved"})


class CorpusInvariantError(ValueError):
    """A corpus record would violate a methodological invariant."""


def published_percentage(result: PublishedComplianceResult) -> int | None:
    """Derive a display percentage without storing it in normalized records."""
    if result == "-1":
        return 0
    if result == "0":
        return 50
    if result == "+1":
        return 100
    return None


def validate_published_result(result: object) -> None:
    """Reject computed-only or fabricated values from the imported score field."""
    if result is not None and result not in PUBLISHED_RESULTS:
        raise CorpusInvariantError(
            "published_result must be -1, 0, +1, not_applicable, or null; "
            "unresolved is computed-only"
        )


def validate_computed_result(result: object) -> None:
    """Validate a Writ-generated result independently from historical labels."""
    if result not in WRIT_RESULTS:
        raise CorpusInvariantError(
            "computed_result must be -1, 0, +1, not_applicable, or unresolved"
        )


def validate_historical_label(label: dict[str, Any], *, authority: str | None = None) -> None:
    """Validate the non-transferable expert-assigned historical label policy."""
    expected = {
        "label_type": HISTORICAL_LABEL_TYPE,
        "usable_for_training_examples": True,
        "usable_for_evaluation": True,
        "usable_for_automatic_score_transfer": False,
    }
    for key, value in expected.items():
        if label.get(key) != value:
            raise CorpusInvariantError(f"historical label field {key} must be {value!r}")
    if not isinstance(label.get("label_authority"), str) or not label["label_authority"]:
        raise CorpusInvariantError("historical labels require a named label_authority")
    if authority is not None and label["label_authority"] != authority:
        raise CorpusInvariantError(
            f"historical label authority must be {authority!r} for this source"
        )
