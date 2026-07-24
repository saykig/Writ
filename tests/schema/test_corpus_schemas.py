from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from writ_ingest.corpus.models import (
    CorpusInvariantError,
    published_percentage,
    validate_computed_result,
    validate_published_result,
)
from writ_ingest.corpus.review_queue import make_review_item
from writ_ingest.corpus.validation import (
    SCHEMA_FILES,
    CorpusValidationError,
    current_member_assessments,
    load_schema,
    validate_corpus_evaluation_eligibility,
    validate_corpus_graph,
    validate_record,
)

ROOT = Path(__file__).resolve().parents[2]


def commitment(
    *,
    institution: str = "G20",
    summit_id: str = "G20.synthetic-summit",
    commitment_id: str = "synthetic.commitment.1",
    exact_text: str = "Same synthetic wording.",
) -> dict[str, object]:
    return {
        "schema_version": "2.0.0",
        "record_type": "identified_commitment",
        "institution": institution,
        "summit_id": summit_id,
        "commitment_id": commitment_id,
        "exact_text": exact_text,
        "issue_areas": [
            {
                "source_term": "Synthetic issue",
                "vocabulary_mapping_id": None,
            }
        ],
        "source_passage_ids": [f"passage.{institution}.{summit_id}.{commitment_id}"],
        "parser_version": "synthetic-test-2",
        "retrieval_date": "2026-07-24",
        "extraction_warnings": ["synthetic_fixture"],
    }


def reconciliation(*, status: str = "valid") -> dict[str, object]:
    return {
        "schema_version": "2.0.0",
        "record_type": "reconciliation_manifest",
        "reconciliation_manifest_id": "reconciliation.synthetic",
        "institution": "G20",
        "summit_id": "G20.synthetic-summit",
        "inventory_source_id": "document.inventory",
        "selected_subset_source_id": "document.selected",
        "extracted_inventory_count": 2,
        "extracted_selected_count": 1,
        "expected_inventory_count": 2,
        "expected_selected_count": 1,
        "validation_status": status,
        "reconciliation_warnings": [] if status == "valid" else ["synthetic_incomplete"],
        "parser_version": "synthetic-test-2",
        "retrieval_date": "2026-07-24",
    }


def selection(
    *,
    status: str = "selected",
    institution: str = "G20",
    summit_id: str = "G20.synthetic-summit",
    commitment_id: str = "synthetic.commitment.1",
    selection_date: str | None = "2026-01-01",
) -> dict[str, object]:
    return {
        "schema_version": "2.0.0",
        "record_type": "assessment_selection",
        "institution": institution,
        "summit_id": summit_id,
        "commitment_id": commitment_id,
        "selection_status": status,
        "selection_source_id": "document.selected",
        "selection_date": selection_date,
        "reconciliation_manifest_id": (
            "reconciliation.synthetic" if status == "not_selected" else None
        ),
        "parser_version": "synthetic-test-2",
        "retrieval_date": "2026-07-24",
        "extraction_warnings": [] if selection_date else ["selection_date_missing"],
    }


def report(
    *,
    report_id: str = "report.synthetic.final",
    stage: str = "final",
    supersedes: str | None = None,
    start: str | None = "2025-01-01",
    end: str | None = "2025-12-31",
    publication: str | None = "2026-01-15",
) -> dict[str, object]:
    missing = any(value is None for value in (start, end, publication))
    return {
        "schema_version": "2.0.0",
        "record_type": "compliance_report",
        "report_id": report_id,
        "institution": "G20",
        "summit_id": "G20.synthetic-summit",
        "report_stage": stage,
        "assessment_window_start": start,
        "assessment_window_end": end,
        "publication_date": publication,
        "supersedes_report_id": supersedes,
        "source_document_id": f"document.{report_id}",
        "parser_version": "synthetic-test-2",
        "retrieval_date": "2026-07-24",
        "extraction_warnings": ["required_date_missing"] if missing else [],
    }


def assessment(
    *,
    assessment_id: str = "assessment.synthetic.final.member",
    report_id: str = "report.synthetic.final",
    commitment_id: str = "synthetic.commitment.1",
    member_id: str = "synthetic_member",
    result: str | None = "+1",
    status: str = "published",
    current: str = "included",
    warnings: list[str] | None = None,
    dispute_reason: str | None = None,
) -> dict[str, object]:
    return {
        "schema_version": "2.0.0",
        "record_type": "member_compliance_assessment",
        "assessment_id": assessment_id,
        "report_id": report_id,
        "commitment_id": commitment_id,
        "member_id": member_id,
        "published_result": result,
        "score_status": status,
        "source_passage_ids": ["passage.score.synthetic"],
        "analyst_reasoning": None,
        "dispute_reason": dispute_reason,
        "current_view_status": current,
        "historical_label": {
            "label_type": "expert_assigned_historical_score",
            "label_authority": "Synthetic Research Group",
            "usable_for_training_examples": True,
            "usable_for_evaluation": True,
            "usable_for_automatic_score_transfer": False,
        },
        "parser_version": "synthetic-test-2",
        "retrieval_date": "2026-07-24",
        "extraction_warnings": warnings or [],
    }


def review(
    *,
    affected: str,
    issue_type: str = "missing_score",
) -> dict[str, object]:
    return make_review_item(
        source_id="synthetic.source",
        passage_id="passage.score.synthetic",
        page_or_section=None,
        issue_type=issue_type,
        parser_version="synthetic-test-2",
        affected_record_ids=[affected],
        original_source_text="synthetic",
    )


def validate_graph(
    *,
    commitments: list[dict[str, object]] | None = None,
    selections: list[dict[str, object]] | None = None,
    reports: list[dict[str, object]] | None = None,
    assessments: list[dict[str, object]] | None = None,
    reconciliations: list[dict[str, object]] | None = None,
    reviews: list[dict[str, object]] | None = None,
    requests: list[dict[str, object]] | None = None,
) -> None:
    validate_corpus_graph(
        commitments=commitments or [commitment()],
        selections=selections or [selection()],
        reports=reports or [report()],
        member_assessments=assessments if assessments is not None else [assessment()],
        reconciliations=reconciliations or [],
        review_items=reviews or [],
        evaluation_requests=requests or [],
    )


def test_all_corpus_schemas_are_valid_draft_2020_12() -> None:
    for kind in SCHEMA_FILES:
        Draft202012Validator.check_schema(load_schema(kind))


def test_identified_commitment_has_no_selection_or_score_fields() -> None:
    record = json.loads(
        (ROOT / "tests/fixtures/synthetic/unassessed-commitment.json").read_text(
            encoding="utf-8"
        )
    )
    validate_record("commitment", record)
    assert "selection_status" not in record
    assert "selected_for_assessment" not in record
    assert "published_result" not in record
    assert "compliance_score" not in record


@pytest.mark.parametrize("status", ["selected", "not_selected", "unknown"])
def test_selection_status_is_closed(status: str) -> None:
    validate_record("assessment", selection(status=status))


@pytest.mark.parametrize("stage", ["preliminary", "interim", "final", "special"])
def test_report_stages_are_closed_and_distinct(stage: str) -> None:
    validate_record("compliance_report", report(stage=stage))


def test_unselected_commitment_requires_valid_reconciliation_and_no_assessments() -> None:
    validate_graph(
        selections=[selection(status="not_selected")],
        assessments=[],
        reconciliations=[reconciliation()],
    )
    with pytest.raises(CorpusValidationError, match="requires selected"):
        validate_graph(
            selections=[selection(status="not_selected")],
            reconciliations=[reconciliation()],
        )
    with pytest.raises(CorpusValidationError, match="valid reconciliation"):
        validate_graph(
            selections=[selection(status="not_selected")],
            assessments=[],
            reconciliations=[reconciliation(status="incomplete")],
            reviews=[review(affected="reconciliation.synthetic", issue_type="incomplete_reconciliation")],
        )


def test_unknown_selection_has_no_assessment_or_evaluation() -> None:
    validate_graph(selections=[selection(status="unknown")], assessments=[])
    with pytest.raises(CorpusValidationError, match="requires selected"):
        validate_graph(selections=[selection(status="unknown")])
    with pytest.raises(CorpusValidationError, match="requires selected"):
        validate_corpus_evaluation_eligibility(
            [selection(status="unknown")],
            {
                "institution": "G20",
                "summit_id": "G20.synthetic-summit",
                "commitment_id": "synthetic.commitment.1",
            },
        )


def test_selected_commitment_can_receive_corpus_evaluation() -> None:
    request = {
        "institution": "G20",
        "summit_id": "G20.synthetic-summit",
        "commitment_id": "synthetic.commitment.1",
        "computed_result": "unresolved",
    }
    validate_graph(requests=[request])


@pytest.mark.parametrize("result", ["-1", "0", "+1", "not_applicable"])
def test_valid_published_results(result: str) -> None:
    record = assessment(result=result)
    validate_record("assessment", record)
    validate_published_result(result)


def test_missing_published_result_requires_warning_and_review() -> None:
    missing = assessment(
        result=None,
        status="missing",
        warnings=["published_score_missing"],
    )
    validate_graph(
        assessments=[missing],
        reviews=[review(affected=missing["assessment_id"])],
    )
    invalid = dict(missing)
    invalid["extraction_warnings"] = []
    with pytest.raises(CorpusValidationError):
        validate_record("assessment", invalid)


def test_imported_unresolved_is_rejected_but_computed_unresolved_is_valid() -> None:
    invalid = assessment(result="unresolved")
    with pytest.raises(CorpusValidationError):
        validate_record("assessment", invalid)
    with pytest.raises(CorpusInvariantError):
        validate_published_result("unresolved")
    validate_computed_result("unresolved")


def test_disputed_and_withdrawn_scores_preserve_published_values() -> None:
    disputed = assessment(
        assessment_id="assessment.disputed",
        member_id="disputed",
        result="0",
        status="disputed",
        dispute_reason="Source correction is under review.",
    )
    withdrawn = assessment(
        assessment_id="assessment.withdrawn",
        member_id="withdrawn",
        result="-1",
        status="withdrawn",
        current="excluded",
    )
    validate_graph(assessments=[disputed, withdrawn])
    current = current_member_assessments([report()], [disputed, withdrawn])
    assert current == [disputed]
    assert withdrawn["published_result"] == "-1"


def test_interim_and_final_assessments_remain_independent() -> None:
    interim_report = report(report_id="report.synthetic.interim", stage="interim")
    final_report = report(
        report_id="report.synthetic.final",
        stage="final",
        supersedes="report.synthetic.interim",
    )
    interim = assessment(
        assessment_id="assessment.interim",
        report_id="report.synthetic.interim",
        result="0",
    )
    final = assessment(
        assessment_id="assessment.final",
        report_id="report.synthetic.final",
        result="+1",
    )
    validate_graph(reports=[interim_report, final_report], assessments=[interim, final])
    assert current_member_assessments([interim_report, final_report], [interim, final]) == [
        final
    ]
    assert interim["published_result"] == "0"
    assert final["published_result"] == "+1"


def test_duplicate_identities_fail_and_text_never_deduplicates() -> None:
    with pytest.raises(CorpusValidationError, match="duplicate identified commitment"):
        validate_graph(commitments=[commitment(), commitment()])
    with pytest.raises(CorpusValidationError, match="duplicate assessment selection"):
        validate_graph(selections=[selection(), selection()])
    with pytest.raises(CorpusValidationError, match="duplicate compliance report"):
        validate_graph(reports=[report(), report()])
    with pytest.raises(CorpusValidationError, match="duplicate member compliance assessment"):
        validate_graph(assessments=[assessment(), assessment()])

    same_text = "Identical source wording."
    g20 = commitment(exact_text=same_text)
    g7 = commitment(
        institution="G7",
        summit_id="G7.synthetic-summit",
        commitment_id="synthetic.commitment.1",
        exact_text=same_text,
    )
    another_g20 = commitment(
        summit_id="G20.another-summit",
        commitment_id="synthetic.commitment.2",
        exact_text=same_text,
    )
    g7_selection = selection(
        institution="G7",
        summit_id="G7.synthetic-summit",
        commitment_id="synthetic.commitment.1",
        status="unknown",
    )
    validate_graph(
        commitments=[g20, g7, another_g20],
        selections=[
            selection(status="unknown"),
            g7_selection,
            selection(
                summit_id="G20.another-summit",
                commitment_id="synthetic.commitment.2",
                status="unknown",
            ),
        ],
        assessments=[],
    )


def test_missing_report_dates_require_warning_and_review() -> None:
    missing_date_report = report(publication=None)
    with pytest.raises(CorpusValidationError, match="missing dates without review"):
        validate_graph(reports=[missing_date_report])
    validate_graph(
        reports=[missing_date_report],
        reviews=[
            review(
                affected=missing_date_report["report_id"],
                issue_type="missing_required_date",
            )
        ],
    )


def test_null_is_never_a_negative_or_computed_result() -> None:
    assert published_percentage(None) is None
    assert published_percentage("-1") == 0
    assert published_percentage("0") == 50
    assert published_percentage("+1") == 100
    with pytest.raises(CorpusInvariantError):
        validate_computed_result(None)


def test_production_code_has_no_missing_classification_to_weak_fallback() -> None:
    benchmark_source = (
        ROOT / "packages/benchmark/src/evidence.ts"
    ).read_text(encoding="utf-8")
    assert '?? "weak"' not in benchmark_source
