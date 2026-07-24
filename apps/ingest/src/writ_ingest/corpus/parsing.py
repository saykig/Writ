"""Parser interfaces that emit warnings instead of invented values."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from .review_queue import make_review_item


class RawSourcesUnavailableError(RuntimeError):
    """Parsing cannot start because no immutable raw sources are available."""


@dataclass(frozen=True)
class ParserResult:
    records: tuple[dict[str, Any], ...]
    warnings: tuple[str, ...]
    failed: bool
    review_items: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class AssessmentExtractionResult:
    assessments: tuple[dict[str, Any], ...]
    review_items: tuple[dict[str, Any], ...]


def require_raw_documents(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    available = [
        document
        for document in manifest.get("documents", [])
        if document.get("fetch_status") in {"retrieved", "imported"}
        and document.get("storage_backend") == "neon_postgres"
        and document.get("storage_object_id")
        and document.get("sha256")
    ]
    if not available:
        raise RawSourcesUnavailableError(
            "no immutable raw sources are available; parsing stopped without output"
        )
    return available


def run_parser_safely(
    parser: Callable[[bytes], list[dict[str, Any]]],
    payload: bytes,
) -> ParserResult:
    """Contain parser errors and return no records on failure."""
    try:
        records = parser(payload)
    except Exception as exc:  # noqa: BLE001
        return ParserResult(
            records=(),
            warnings=(f"parser_failed:{type(exc).__name__}",),
            failed=True,
        )
    if not isinstance(records, list) or any(not isinstance(item, dict) for item in records):
        return ParserResult(
            records=(),
            warnings=("parser_failed:invalid_record_shape",),
            failed=True,
        )
    return ParserResult(records=tuple(records), warnings=(), failed=False)


def extract_member_assessment_row(
    *,
    base_record: dict[str, Any],
    raw_score: str | None,
    identity_status: str,
    source_id: str,
    passage_id: str | None,
    page_or_section: str | None,
    original_source_text: str | None,
) -> AssessmentExtractionResult:
    """Normalize a clear row or quarantine an ambiguous row for review."""
    parser_version = str(base_record["parser_version"])
    affected = [str(base_record["assessment_id"])]
    if identity_status != "clear":
        issue_type = {
            "ambiguous_member": "ambiguous_member_identity",
            "ambiguous_commitment": "ambiguous_commitment_identity",
        }.get(identity_status, "ambiguous_row_identity")
        review = make_review_item(
            source_id=source_id,
            passage_id=passage_id,
            page_or_section=page_or_section,
            issue_type=issue_type,
            parser_version=parser_version,
            affected_record_ids=affected,
            original_source_text=original_source_text,
        )
        return AssessmentExtractionResult(assessments=(), review_items=(review,))

    normalized = raw_score.strip() if raw_score is not None else ""
    normalized = "-1" if normalized == "−1" else normalized
    if normalized in {"-1", "0", "+1", "not_applicable"}:
        record = {
            **base_record,
            "published_result": normalized,
            "score_status": "published",
            "dispute_reason": None,
            "current_view_status": "included",
        }
        return AssessmentExtractionResult(assessments=(record,), review_items=())

    warning = "published_score_missing" if normalized == "" else "published_score_unreadable"
    issue_type = "missing_score" if normalized == "" else "failed_score_extraction"
    record = {
        **base_record,
        "published_result": None,
        "score_status": "missing",
        "dispute_reason": None,
        "current_view_status": "included",
        "extraction_warnings": sorted(
            {*base_record.get("extraction_warnings", []), warning}
        ),
    }
    review = make_review_item(
        source_id=source_id,
        passage_id=passage_id,
        page_or_section=page_or_section,
        issue_type=issue_type,
        parser_version=parser_version,
        affected_record_ids=affected,
        original_source_text=original_source_text,
    )
    return AssessmentExtractionResult(assessments=(record,), review_items=(review,))
