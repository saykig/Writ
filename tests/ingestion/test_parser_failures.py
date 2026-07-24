from writ_ingest.corpus.parsing import (
    extract_member_assessment_row,
    run_parser_safely,
)
from writ_ingest.corpus.validation import validate_record


def test_parser_failure_emits_warning_and_no_fabricated_records() -> None:
    def failing_parser(_payload: bytes) -> list[dict[str, object]]:
        raise ValueError("synthetic parser failure")

    result = run_parser_safely(failing_parser, b"synthetic bytes")
    assert result.failed is True
    assert result.records == ()
    assert result.warnings == ("parser_failed:ValueError",)


def base_assessment() -> dict[str, object]:
    return {
        "schema_version": "2.0.0",
        "record_type": "member_compliance_assessment",
        "assessment_id": "assessment.synthetic.row",
        "report_id": "report.synthetic",
        "commitment_id": "commitment.synthetic",
        "member_id": "member.synthetic",
        "source_passage_ids": ["passage.synthetic.row"],
        "analyst_reasoning": None,
        "historical_label": {
            "label_type": "expert_assigned_historical_score",
            "label_authority": "Synthetic Research Group",
            "usable_for_training_examples": True,
            "usable_for_evaluation": True,
            "usable_for_automatic_score_transfer": False,
        },
        "parser_version": "synthetic-parser@2.0.0",
        "retrieval_date": "2026-07-24",
        "extraction_warnings": [],
    }


def test_clear_row_with_blank_score_creates_missing_assessment_and_review() -> None:
    result = extract_member_assessment_row(
        base_record=base_assessment(),
        raw_score=" ",
        identity_status="clear",
        source_id="synthetic.source",
        passage_id="passage.synthetic.row",
        page_or_section="table row 1",
        original_source_text="Member | Commitment |",
    )
    assert len(result.assessments) == 1
    assert len(result.review_items) == 1
    assessment = result.assessments[0]
    assert assessment["published_result"] is None
    assert assessment["score_status"] == "missing"
    assert "published_score_missing" in assessment["extraction_warnings"]
    validate_record("assessment", assessment)
    validate_record("review_item", result.review_items[0])


def test_ambiguous_row_creates_only_review_item() -> None:
    result = extract_member_assessment_row(
        base_record=base_assessment(),
        raw_score="-1",
        identity_status="ambiguous_member",
        source_id="synthetic.source",
        passage_id="passage.synthetic.row",
        page_or_section="table row 2",
        original_source_text="Unreadable member | -1",
    )
    assert result.assessments == ()
    assert len(result.review_items) == 1
    assert result.review_items[0]["issue_type"] == "ambiguous_member_identity"


def test_unreadable_score_never_becomes_negative_or_unresolved() -> None:
    result = extract_member_assessment_row(
        base_record=base_assessment(),
        raw_score="illegible",
        identity_status="clear",
        source_id="synthetic.source",
        passage_id="passage.synthetic.row",
        page_or_section="table row 3",
        original_source_text="Member | illegible",
    )
    assert result.assessments[0]["published_result"] is None
    assert result.assessments[0]["score_status"] == "missing"
    assert result.review_items[0]["issue_type"] == "failed_score_extraction"
