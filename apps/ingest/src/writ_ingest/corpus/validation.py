"""JSON Schema and cross-record validation for the normalized compliance corpus."""

from __future__ import annotations

import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from .models import (
    CorpusInvariantError,
    validate_computed_result,
    validate_historical_label,
    validate_published_result,
)
from .registry import find_repo_root

SCHEMA_FILES = {
    "source_document": "compatibility/compliance-corpus-v2/source_document.schema.json",
    "commitment": "compatibility/compliance-corpus-v2/commitment.schema.json",
    "assessment": "compatibility/compliance-corpus-v2/assessment.schema.json",
    "compliance_report": "compatibility/compliance-corpus-v2/compliance_report.schema.json",
    "evidence": "compatibility/compliance-corpus-v2/evidence.schema.json",
    "methodology": "compatibility/compliance-corpus-v2/methodology.schema.json",
    "source_manifest": "compatibility/compliance-corpus-v2/source_manifest.schema.json",
    "reconciliation_manifest": (
        "compatibility/compliance-corpus-v2/reconciliation_manifest.schema.json"
    ),
    "review_item": "compatibility/compliance-corpus-v2/review_item.schema.json",
    "corpus_vocabulary": "core/corpus_vocabulary.schema.json",
}


class CorpusValidationError(ValueError):
    """One or more corpus records are invalid."""


def load_schema(kind: str, *, root: Path | None = None) -> dict[str, Any]:
    if kind not in SCHEMA_FILES:
        raise CorpusValidationError(f"unknown corpus schema kind: {kind}")
    repo_root = root or find_repo_root()
    path = repo_root / "schemas" / SCHEMA_FILES[kind]
    return json.loads(path.read_text(encoding="utf-8"))


def validate_record(kind: str, record: dict[str, Any], *, root: Path | None = None) -> None:
    schema = load_schema(kind, root=root)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(record), key=lambda item: list(item.absolute_path))
    if errors:
        details = "; ".join(
            f"/{'/'.join(str(part) for part in error.absolute_path)}: {error.message}"
            for error in errors[:20]
        )
        raise CorpusValidationError(f"invalid {kind} record: {details}")
    if kind == "assessment" and record.get("record_type") == "member_compliance_assessment":
        try:
            validate_published_result(record["published_result"])
            validate_historical_label(record["historical_label"])
        except CorpusInvariantError as exc:
            raise CorpusValidationError(str(exc)) from exc


def validate_record_for_source(
    kind: str,
    record: dict[str, Any],
    source: dict[str, Any],
    *,
    root: Path | None = None,
) -> None:
    """Validate a record and any source-specific historical-label authority."""
    validate_record(kind, record, root=root)
    if kind != "assessment" or record.get("record_type") != "member_compliance_assessment":
        return
    policy = source.get("historical_label")
    if policy is None:
        return
    try:
        validate_historical_label(
            record["historical_label"],
            authority=policy.get("label_authority"),
        )
    except CorpusInvariantError as exc:
        raise CorpusValidationError(str(exc)) from exc


def _unique_index(
    records: Iterable[dict[str, Any]],
    *,
    key_fields: tuple[str, ...],
    record_name: str,
) -> dict[tuple[Any, ...], dict[str, Any]]:
    index: dict[tuple[Any, ...], dict[str, Any]] = {}
    for record in records:
        key = tuple(record[field] for field in key_fields)
        if key in index:
            raise CorpusValidationError(f"duplicate {record_name} identity: {key}")
        index[key] = record
    return index


def _reviewed_record_ids(review_items: list[dict[str, Any]]) -> set[str]:
    return {
        identifier
        for item in review_items
        for identifier in item.get("affected_record_ids", [])
    }


def _selection_identity(selection: dict[str, Any]) -> str:
    return (
        f"{selection['institution']}:{selection['summit_id']}:{selection['commitment_id']}"
    )


def validate_corpus_evaluation_eligibility(
    selections: list[dict[str, Any]],
    request: dict[str, Any],
) -> None:
    """Reject corpus evaluation unless the identified commitment was selected."""
    selection_by_key = _unique_index(
        selections,
        key_fields=("institution", "summit_id", "commitment_id"),
        record_name="assessment selection",
    )
    key = (
        request["institution"],
        request["summit_id"],
        request["commitment_id"],
    )
    selection = selection_by_key.get(key)
    if selection is None or selection["selection_status"] != "selected":
        status = selection["selection_status"] if selection else "absent"
        raise CorpusValidationError(
            f"corpus evaluation for {key} requires selected commitment; found {status}"
        )


def validate_corpus_graph(
    *,
    commitments: list[dict[str, Any]],
    selections: list[dict[str, Any]],
    reports: list[dict[str, Any]],
    member_assessments: list[dict[str, Any]],
    reconciliations: list[dict[str, Any]],
    review_items: list[dict[str, Any]],
    evaluation_requests: list[dict[str, Any]] | None = None,
    passage_ids: set[str] | None = None,
    source_document_ids: set[str] | None = None,
) -> None:
    """Validate identities, provenance, selection eligibility, and report history."""
    for record in commitments:
        validate_record("commitment", record)
    for record in [*selections, *member_assessments]:
        validate_record("assessment", record)
    for record in reports:
        validate_record("compliance_report", record)
    for record in reconciliations:
        validate_record("reconciliation_manifest", record)
    for record in review_items:
        validate_record("review_item", record)

    commitment_by_key = _unique_index(
        commitments,
        key_fields=("institution", "summit_id", "commitment_id"),
        record_name="identified commitment",
    )
    selection_by_key = _unique_index(
        selections,
        key_fields=("institution", "summit_id", "commitment_id"),
        record_name="assessment selection",
    )
    report_by_key = _unique_index(
        reports,
        key_fields=("report_id",),
        record_name="compliance report",
    )
    assessment_by_key = _unique_index(
        member_assessments,
        key_fields=("report_id", "commitment_id", "member_id"),
        record_name="member compliance assessment",
    )
    if len({record["assessment_id"] for record in member_assessments}) != len(
        member_assessments
    ):
        raise CorpusValidationError("duplicate member assessment_id")
    reconciliation_by_key = _unique_index(
        reconciliations,
        key_fields=("reconciliation_manifest_id",),
        record_name="reconciliation manifest",
    )
    reviewed_ids = _reviewed_record_ids(review_items)

    if passage_ids is not None:
        for commitment in commitments:
            missing = set(commitment["source_passage_ids"]) - passage_ids
            if missing:
                raise CorpusValidationError(
                    f"commitment {commitment['commitment_id']} references unknown passages: "
                    f"{sorted(missing)}"
                )
        for assessment in member_assessments:
            missing = set(assessment["source_passage_ids"]) - passage_ids
            if missing:
                raise CorpusValidationError(
                    f"assessment {assessment['assessment_id']} references unknown passages: "
                    f"{sorted(missing)}"
                )

    if source_document_ids is not None:
        for report in reports:
            if report["source_document_id"] not in source_document_ids:
                raise CorpusValidationError(
                    f"report {report['report_id']} references unknown source document"
                )

    for reconciliation in reconciliations:
        identifier = reconciliation["reconciliation_manifest_id"]
        status = reconciliation["validation_status"]
        inventory_count = reconciliation["extracted_inventory_count"]
        selected_count = reconciliation["extracted_selected_count"]
        if selected_count > inventory_count:
            raise CorpusValidationError(
                f"reconciliation {identifier} selects more commitments than its inventory"
            )
        if status == "valid":
            for expected_field, extracted_field in (
                ("expected_inventory_count", "extracted_inventory_count"),
                ("expected_selected_count", "extracted_selected_count"),
            ):
                expected = reconciliation[expected_field]
                if expected is not None and expected != reconciliation[extracted_field]:
                    raise CorpusValidationError(
                        f"valid reconciliation {identifier} disagrees with {expected_field}"
                    )
        elif identifier not in reviewed_ids:
            raise CorpusValidationError(
                f"non-valid reconciliation {identifier} requires a review item"
            )

    for selection in selections:
        key = (
            selection["institution"],
            selection["summit_id"],
            selection["commitment_id"],
        )
        if key not in commitment_by_key:
            raise CorpusValidationError(f"selection references unknown commitment: {key}")
        if selection["selection_date"] is None and _selection_identity(selection) not in reviewed_ids:
            raise CorpusValidationError(
                f"selection {_selection_identity(selection)} has a missing date without review"
            )
        if selection["selection_status"] == "not_selected":
            reconciliation_id = selection["reconciliation_manifest_id"]
            reconciliation_record = reconciliation_by_key.get((reconciliation_id,))
            if reconciliation_record is None:
                raise CorpusValidationError(
                    f"not_selected commitment {key} has no reconciliation manifest"
                )
            if reconciliation_record["validation_status"] != "valid":
                raise CorpusValidationError(
                    f"not_selected commitment {key} requires a valid reconciliation"
                )
            if (
                reconciliation_record["institution"],
                reconciliation_record["summit_id"],
            ) != key[:2]:
                raise CorpusValidationError(
                    f"not_selected commitment {key} crosses reconciliation scope"
                )
            if (
                selection["selection_source_id"]
                != reconciliation_record["selected_subset_source_id"]
            ):
                raise CorpusValidationError(
                    f"not_selected commitment {key} does not reference the reconciled subset"
                )

    for report in reports:
        if any(
            report[field] is None
            for field in (
                "assessment_window_start",
                "assessment_window_end",
                "publication_date",
            )
        ) and report["report_id"] not in reviewed_ids:
            raise CorpusValidationError(
                f"report {report['report_id']} has missing dates without review"
            )
        supersedes = report["supersedes_report_id"]
        if supersedes is None:
            continue
        prior = report_by_key.get((supersedes,))
        if prior is None:
            raise CorpusValidationError(
                f"report {report['report_id']} supersedes an unknown report"
            )
        if prior["report_id"] == report["report_id"]:
            raise CorpusValidationError("a compliance report cannot supersede itself")
        if (prior["institution"], prior["summit_id"]) != (
            report["institution"],
            report["summit_id"],
        ):
            raise CorpusValidationError(
                f"report {report['report_id']} crosses summit or institution when superseding"
            )
        if prior["report_stage"] == report["report_stage"]:
            raise CorpusValidationError(
                f"report {report['report_id']} cannot supersede the same report stage"
            )

    for assessment in assessment_by_key.values():
        assessment_report = report_by_key.get((assessment["report_id"],))
        if assessment_report is None:
            raise CorpusValidationError(
                f"assessment {assessment['assessment_id']} references unknown report"
            )
        commitment_key = (
            assessment_report["institution"],
            assessment_report["summit_id"],
            assessment["commitment_id"],
        )
        if commitment_key not in commitment_by_key:
            raise CorpusValidationError(
                f"assessment {assessment['assessment_id']} references unknown commitment"
            )
        assessment_selection = selection_by_key.get(commitment_key)
        if (
            assessment_selection is None
            or assessment_selection["selection_status"] != "selected"
        ):
            status = (
                assessment_selection["selection_status"]
                if assessment_selection
                else "absent"
            )
            raise CorpusValidationError(
                f"assessment {assessment['assessment_id']} requires selected commitment; "
                f"found {status}"
            )
        if (
            assessment["score_status"] == "missing"
            and assessment["assessment_id"] not in reviewed_ids
        ):
            raise CorpusValidationError(
                f"missing assessment {assessment['assessment_id']} requires review"
            )
        if assessment["published_result"] == "-1" and not assessment["source_passage_ids"]:
            raise CorpusValidationError(
                f"published -1 assessment {assessment['assessment_id']} requires source passage"
            )
        if (
            assessment["score_status"] == "withdrawn"
            and assessment["current_view_status"] != "excluded"
        ):
            raise CorpusValidationError(
                f"withdrawn assessment {assessment['assessment_id']} must be excluded"
            )

    for request in evaluation_requests or []:
        validate_corpus_evaluation_eligibility(selections, request)
        if "computed_result" in request:
            try:
                validate_computed_result(request["computed_result"])
            except CorpusInvariantError as exc:
                raise CorpusValidationError(str(exc)) from exc


def current_member_assessments(
    reports: list[dict[str, Any]],
    member_assessments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Project current report versions without mutating historical records."""
    superseded = {
        report["supersedes_report_id"]
        for report in reports
        if report["supersedes_report_id"] is not None
    }
    current_report_ids = {
        report["report_id"] for report in reports if report["report_id"] not in superseded
    }
    return [
        assessment
        for assessment in member_assessments
        if assessment["report_id"] in current_report_ids
        and assessment["current_view_status"] == "included"
        and assessment["score_status"] != "withdrawn"
    ]
