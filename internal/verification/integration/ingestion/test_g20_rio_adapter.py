from __future__ import annotations

import pytest
from writ_ingest.corpus.adapters.g20 import G20RioAdapter
from writ_ingest.corpus.validation import validate_corpus_graph
from writ_ingest.corpus.vocabulary import (
    load_vocabulary,
    validate_vocabulary_review_items,
)

FINAL_REPORT = "g20.2024.rio.final.compliance"
INTERIM_REPORT = "g20.2024.rio.interim.compliance"


@pytest.fixture(scope="module")
def output() -> object:
    return G20RioAdapter().emit()


def _score(output: object, report_id: str, commitment_id: str, member_id: str) -> object:
    for assessment in output.member_assessments:  # type: ignore[attr-defined]
        if (
            assessment["report_id"] == report_id
            and assessment["commitment_id"] == commitment_id
            and assessment["member_id"] == member_id
        ):
            return assessment["published_result"]
    raise AssertionError(f"assessment not found: {report_id} {commitment_id} {member_id}")


def test_counts(output: object) -> None:
    assert len(output.commitments) == 13
    assert len(output.selections) == 13
    assert len(output.reports) == 2
    assert len(output.member_assessments) == 546  # 13 commitments x 21 members x 2 reports
    assert len(output.reconciliations) == 1
    assert len(output.review_items) == 15


def test_graph_validates(output: object) -> None:
    validate_corpus_graph(
        commitments=list(output.commitments),
        selections=list(output.selections),
        reports=list(output.reports),
        member_assessments=list(output.member_assessments),
        reconciliations=list(output.reconciliations),
        review_items=list(output.review_items),
        passage_ids=set(output.passage_ids),
        source_document_ids=set(output.source_document_ids),
    )


def test_vocabulary_is_reviewed_and_covered(output: object) -> None:
    vocabulary = load_vocabulary()
    g20_mappings = [
        m for m in vocabulary["mappings"] if m["source_id"] == "g20_research_group"
    ]
    assert g20_mappings, "expected G20 vocabulary mappings"
    # The adapter relies only on reviewed mappings, so it emits no vocabulary review items.
    assert all(m["mapping_status"] == "reviewed" for m in g20_mappings)
    # Review coverage is checked for the active G20 adapter independently of the
    # retired compliance benchmark fixture adapter.
    validate_vocabulary_review_items({"mappings": g20_mappings}, list(output.review_items))


def test_interim_and_final_are_separate(output: object) -> None:
    reports = {r["report_id"]: r for r in output.reports}
    assert set(reports) == {FINAL_REPORT, INTERIM_REPORT}
    assert reports[FINAL_REPORT]["report_stage"] == "final"
    assert reports[INTERIM_REPORT]["report_stage"] == "interim"
    # Neither supersedes the other; both remain independent records.
    assert all(r["supersedes_report_id"] is None for r in output.reports)
    # Distinct windows and publication dates.
    assert reports[FINAL_REPORT]["assessment_window_end"] == "2025-08-20"
    assert reports[INTERIM_REPORT]["assessment_window_end"] == "2025-05-31"
    assert reports[FINAL_REPORT]["publication_date"] == "2025-11-18"
    assert reports[INTERIM_REPORT]["publication_date"] == "2025-09-16"
    # Assessments partition cleanly by report.
    by_report: dict[str, int] = {}
    for assessment in output.member_assessments:
        by_report[assessment["report_id"]] = by_report.get(assessment["report_id"], 0) + 1
    assert by_report == {FINAL_REPORT: 273, INTERIM_REPORT: 273}


def test_published_scores_imported_exactly(output: object) -> None:
    # Verbatim cells from Table 2 of each report.
    assert _score(output, FINAL_REPORT, "2024-122", "argentina") == "0"
    assert _score(output, FINAL_REPORT, "2024-122", "united_states") == "+1"
    assert _score(output, FINAL_REPORT, "2024-150", "african_union") == "not_applicable"
    assert _score(output, FINAL_REPORT, "2024-16", "argentina") == "-1"
    assert _score(output, FINAL_REPORT, "2024-59", "mexico") == "-1"
    # Interim and final diverge for the same cell, and both are preserved.
    assert _score(output, INTERIM_REPORT, "2024-168", "brazil") == "0"
    assert _score(output, FINAL_REPORT, "2024-168", "brazil") == "+1"


def test_no_scoring_or_inference(output: object) -> None:
    published = {"-1", "0", "+1", "not_applicable"}
    for assessment in output.member_assessments:
        if assessment["score_status"] == "published":
            assert assessment["published_result"] in published
        elif assessment["score_status"] == "missing":
            assert assessment["published_result"] is None
            # A missing score must be quarantined in the review queue.
            reviewed = {
                ref
                for item in output.review_items
                for ref in item["affected_record_ids"]
            }
            assert assessment["assessment_id"] in reviewed
        # No computed-only token may appear in the imported field.
        assert assessment["published_result"] != "unresolved"


def test_published_negative_one_has_source_passage(output: object) -> None:
    for assessment in output.member_assessments:
        if assessment["published_result"] == "-1":
            assert assessment["source_passage_ids"], assessment["assessment_id"]


def test_no_assessment_for_unselected_or_unknown(output: object) -> None:
    assert all(s["selection_status"] == "selected" for s in output.selections)
    selected_ids = {s["commitment_id"] for s in output.selections}
    for assessment in output.member_assessments:
        assert assessment["commitment_id"] in selected_ids


def test_historical_label_policy(output: object) -> None:
    for assessment in output.member_assessments:
        label = assessment["historical_label"]
        assert label["label_authority"] == "G20 Research Group"
        assert label["usable_for_automatic_score_transfer"] is False
        assert label["usable_for_training_examples"] is True


def test_reconciliation_records_inventory_counts(output: object) -> None:
    reconciliation = output.reconciliations[0]
    assert reconciliation["expected_inventory_count"] == 174
    assert reconciliation["expected_selected_count"] == 13
    assert reconciliation["extracted_selected_count"] == 13
    # Not enumerating the full inventory is surfaced, not hidden.
    assert reconciliation["validation_status"] != "valid"
    reviewed = {
        ref for item in output.review_items for ref in item["affected_record_ids"]
    }
    assert reconciliation["reconciliation_manifest_id"] in reviewed


def test_final_window_discrepancy_is_flagged(output: object) -> None:
    conflicts = [
        item
        for item in output.review_items
        if item["issue_type"] == "conflicting_source_records"
        and FINAL_REPORT in item["affected_record_ids"]
    ]
    assert len(conflicts) == 1


def test_deterministic(output: object) -> None:
    again = G20RioAdapter().emit()
    assert list(again.commitments) == list(output.commitments)
    assert list(again.selections) == list(output.selections)
    assert list(again.reports) == list(output.reports)
    assert list(again.member_assessments) == list(output.member_assessments)
    assert list(again.reconciliations) == list(output.reconciliations)
    assert list(again.review_items) == list(output.review_items)
    assert again.passage_ids == output.passage_ids
    assert again.source_document_ids == output.source_document_ids
