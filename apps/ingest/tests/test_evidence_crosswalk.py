"""Unit coverage for the read-only evidence diagnostic projection."""

from __future__ import annotations

import pytest

from writ_ingest.corpus.eu_us_ai_governance import (
    SEMANTIC_VALUES,
    diagnostic_result_sort_key,
    project_explicit_semantic,
    resolve_snapshot_claim_identity,
    resolve_snapshot_document_version_identity,
    resolve_snapshot_passage_identity,
    resolve_snapshot_reviewed_object_identity,
    semantic_dimensions_correspond,
)


def source_identity(object_kind: str = "snapshot_claim") -> dict[str, object]:
    return {
        "jurisdiction": "US",
        "object_kind": object_kind,
        "id": "source-1",
        "legacy_refs": ["US-01"],
    }


@pytest.mark.parametrize(
    ("concept", "value"),
    [
        (concept, value)
        for concept, values in SEMANTIC_VALUES.items()
        for value in sorted(values)
    ],
)
def test_every_explicit_phase_one_semantic_value_maps_exactly(
    concept: str, value: str
) -> None:
    result = project_explicit_semantic(
        source_concept=concept,
        value=value,
        source_identity=source_identity(),
        source_pointer="fixture#/value",
    )

    assert result["mapping_status"] == "mapped"
    assert result["reason_code"] == "EXACT_SOURCE_VALUE"
    assert result["mapped_values"] == {concept: value}
    assert result["target_identity"] is None


@pytest.mark.parametrize("concept", sorted(SEMANTIC_VALUES))
def test_absent_semantics_remain_absent(concept: str) -> None:
    result = project_explicit_semantic(
        source_concept=concept,
        value=None,
        source_identity=source_identity(),
        source_pointer="fixture#/absent",
    )

    assert result["mapping_status"] == "unmapped"
    assert result["reason_code"] == "SOURCE_VALUE_ABSENT"
    assert result["mapped_values"] == {}
    assert result["unmapped_concepts"] == [concept]


@pytest.mark.parametrize("concept", sorted(SEMANTIC_VALUES))
def test_invalid_semantics_are_errors(concept: str) -> None:
    result = project_explicit_semantic(
        source_concept=concept,
        value="not-a-declared-value",
        source_identity=source_identity(),
        source_pointer="fixture#/invalid",
    )

    assert result["mapping_status"] == "error"
    assert result["reason_code"].startswith("INVALID_")
    assert result["mapped_values"] == {}


def test_basis_is_documented_but_not_projected_or_conflated() -> None:
    assert "basis" not in SEMANTIC_VALUES
    assert not semantic_dimensions_correspond("basis", "support_type")
    assert not semantic_dimensions_correspond("support_type", "basis")
    assert not semantic_dimensions_correspond("stance", "truth_value")

    result = project_explicit_semantic(
        source_concept="support_type",
        value="direct",
        target_concept="basis",
        source_identity=source_identity(),
        source_pointer="fixture#/support_type",
    )
    assert result["mapping_status"] == "unmapped"
    assert result["reason_code"] == "NO_SEMANTIC_CORRESPONDENCE"
    assert result["mapped_values"] == {}


def test_explicit_semantics_do_not_depend_on_identity_resolution() -> None:
    semantic = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/evidence_links/0/stance",
        passage_id="missing-passage",
        evidence_link_position=0,
    )
    identity = resolve_snapshot_claim_identity(
        snapshot_claim={"id": "snapshot-claim", "qualifiers": {"row_id": "US-404"}},
        active_claims=[],
        jurisdiction="US",
        source_pointer="fixture#/claims/0",
    )

    assert semantic["mapping_status"] == "mapped"
    assert semantic["mapped_values"] == {"stance": "supports"}
    assert identity["mapping_status"] == "unresolved"
    assert identity["reason_code"] == "CLAIM_IDENTITY_NOT_FOUND"


def test_claim_identity_results_cover_success_missing_ambiguous_and_absent_key() -> None:
    claim = {"id": "claim-us-01", "qualifiers": {"row_id": "US-01"}}
    target = {
        "machine_id": "active-claim",
        "jurisdiction": "US",
        "legacy_refs": ["US-01"],
    }
    exact = resolve_snapshot_claim_identity(
        snapshot_claim=claim,
        active_claims=[target],
        jurisdiction="US",
        source_pointer="fixture#/claims/0",
    )
    missing = resolve_snapshot_claim_identity(
        snapshot_claim=claim,
        active_claims=[],
        jurisdiction="US",
        source_pointer="fixture#/claims/0",
    )
    ambiguous = resolve_snapshot_claim_identity(
        snapshot_claim=claim,
        active_claims=[target, target],
        jurisdiction="US",
        source_pointer="fixture#/claims/0",
    )
    absent_key = resolve_snapshot_claim_identity(
        snapshot_claim={"id": "claim-us-01", "qualifiers": {}},
        active_claims=[target],
        jurisdiction="US",
        source_pointer="fixture#/claims/0",
    )

    assert (exact["mapping_status"], exact["reason_code"]) == (
        "mapped",
        "CLAIM_IDENTITY_EXACT",
    )
    assert (missing["mapping_status"], missing["reason_code"]) == (
        "unresolved",
        "CLAIM_IDENTITY_NOT_FOUND",
    )
    assert (ambiguous["mapping_status"], ambiguous["reason_code"]) == (
        "error",
        "CLAIM_IDENTITY_AMBIGUOUS",
    )
    assert (absent_key["mapping_status"], absent_key["reason_code"]) == (
        "error",
        "CLAIM_IDENTIFIER_MISSING",
    )


def test_document_identity_results_are_object_specific() -> None:
    document = {"id": "dv-us-01"}
    target = {
        "machine_id": "active-source",
        "jurisdiction": "US",
        "legacy_refs": ["dv-us-01"],
    }

    exact = resolve_snapshot_document_version_identity(
        snapshot_document=document,
        active_sources=[target],
        jurisdiction="US",
        source_pointer="fixture#/document_versions/0",
    )
    missing = resolve_snapshot_document_version_identity(
        snapshot_document=document,
        active_sources=[],
        jurisdiction="US",
        source_pointer="fixture#/document_versions/0",
    )
    ambiguous = resolve_snapshot_document_version_identity(
        snapshot_document=document,
        active_sources=[target, target],
        jurisdiction="US",
        source_pointer="fixture#/document_versions/0",
    )
    absent_key = resolve_snapshot_document_version_identity(
        snapshot_document={},
        active_sources=[],
        jurisdiction="US",
        source_pointer="fixture#/document_versions/0",
    )

    assert exact["reason_code"] == "DOCUMENT_SOURCE_IDENTITY_EXACT"
    assert missing["reason_code"] == "DOCUMENT_SOURCE_IDENTITY_NOT_FOUND"
    assert ambiguous["reason_code"] == "DOCUMENT_SOURCE_IDENTITY_AMBIGUOUS"
    assert absent_key["reason_code"] == "DOCUMENT_VERSION_IDENTIFIER_MISSING"


def test_passage_identity_checks_ambiguity_and_document_consistency() -> None:
    passage = {"id": "passage-us-01", "document_version_id": "dv-us-01"}
    active_passage = {
        "machine_id": "active-passage",
        "jurisdiction": "US",
        "legacy_refs": ["passage-us-01"],
        "source_machine_id": "active-source",
    }
    active_source = {
        "machine_id": "active-source",
        "jurisdiction": "US",
        "legacy_refs": ["dv-us-01"],
    }
    exact = resolve_snapshot_passage_identity(
        snapshot_passage=passage,
        active_passages=[active_passage],
        active_sources=[active_source],
        jurisdiction="US",
        source_pointer="fixture#/passages/0",
    )
    missing = resolve_snapshot_passage_identity(
        snapshot_passage=passage,
        active_passages=[],
        active_sources=[active_source],
        jurisdiction="US",
        source_pointer="fixture#/passages/0",
    )
    ambiguous = resolve_snapshot_passage_identity(
        snapshot_passage=passage,
        active_passages=[active_passage, active_passage],
        active_sources=[active_source],
        jurisdiction="US",
        source_pointer="fixture#/passages/0",
    )
    inconsistent = resolve_snapshot_passage_identity(
        snapshot_passage=passage,
        active_passages=[{**active_passage, "source_machine_id": "other-source"}],
        active_sources=[active_source],
        jurisdiction="US",
        source_pointer="fixture#/passages/0",
    )
    absent_key = resolve_snapshot_passage_identity(
        snapshot_passage={"document_version_id": "dv-us-01"},
        active_passages=[active_passage],
        active_sources=[active_source],
        jurisdiction="US",
        source_pointer="fixture#/passages/0",
    )

    assert exact["reason_code"] == "PASSAGE_IDENTITY_EXACT"
    assert missing["reason_code"] == "PASSAGE_IDENTITY_NOT_FOUND"
    assert ambiguous["reason_code"] == "PASSAGE_IDENTITY_AMBIGUOUS"
    assert inconsistent["reason_code"] == "PASSAGE_DOCUMENT_IDENTITY_INCONSISTENT"
    assert absent_key["reason_code"] == "PASSAGE_IDENTIFIER_MISSING"


def test_snapshot_review_resolves_only_to_its_snapshot_object() -> None:
    claim = {"id": "claim-us-01"}
    review = {
        "id": "review-claim-us-01",
        "object_type": "claim",
        "object_id": "claim-us-01",
    }
    exact = resolve_snapshot_reviewed_object_identity(
        snapshot_review=review,
        snapshot_objects={"claim": [claim], "action": []},
        jurisdiction="US",
        source_pointer="fixture#/reviews/0",
    )
    missing = resolve_snapshot_reviewed_object_identity(
        snapshot_review=review,
        snapshot_objects={"claim": [], "action": []},
        jurisdiction="US",
        source_pointer="fixture#/reviews/0",
    )
    ambiguous = resolve_snapshot_reviewed_object_identity(
        snapshot_review=review,
        snapshot_objects={"claim": [claim, claim], "action": []},
        jurisdiction="US",
        source_pointer="fixture#/reviews/0",
    )
    wrong_type = resolve_snapshot_reviewed_object_identity(
        snapshot_review=review,
        snapshot_objects={"claim": [], "action": [claim]},
        jurisdiction="US",
        source_pointer="fixture#/reviews/0",
    )
    absent_key = resolve_snapshot_reviewed_object_identity(
        snapshot_review={"id": "review-claim-us-01", "object_type": "claim"},
        snapshot_objects={"claim": [claim], "action": []},
        jurisdiction="US",
        source_pointer="fixture#/reviews/0",
    )

    assert exact["reason_code"] == "REVIEWED_OBJECT_IDENTITY_EXACT"
    assert exact["target_identity"] == {
        "jurisdiction": "US",
        "object_kind": "snapshot_claim",
        "id": "claim-us-01",
    }
    assert missing["reason_code"] == "REVIEWED_OBJECT_NOT_FOUND"
    assert ambiguous["reason_code"] == "REVIEWED_OBJECT_AMBIGUOUS"
    assert wrong_type["reason_code"] == "REVIEWED_OBJECT_TYPE_MISMATCH"
    assert absent_key["reason_code"] == "REVIEWED_OBJECT_IDENTIFIER_MISSING"


def test_sorting_uses_source_pointer_before_other_link_coordinates() -> None:
    second = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/1/stance",
        passage_id="passage-1",
        evidence_link_position=0,
    )
    first = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/0/stance",
        passage_id="passage-1",
        evidence_link_position=0,
    )

    assert sorted([second, first], key=diagnostic_result_sort_key) == [first, second]


def test_sorting_uses_passage_id_when_source_pointers_match() -> None:
    second = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/0/stance",
        passage_id="passage-2",
        evidence_link_position=0,
    )
    first = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/0/stance",
        passage_id="passage-1",
        evidence_link_position=0,
    )

    assert sorted([second, first], key=diagnostic_result_sort_key) == [first, second]


def test_sorting_uses_evidence_position_when_pointers_and_passages_match() -> None:
    second = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/0/stance",
        passage_id="passage-1",
        evidence_link_position=1,
    )
    first = project_explicit_semantic(
        source_concept="stance",
        value="supports",
        source_identity=source_identity(),
        source_pointer="fixture#/claims/0/evidence_links/0/stance",
        passage_id="passage-1",
        evidence_link_position=0,
    )

    assert sorted([second, first], key=diagnostic_result_sort_key) == [first, second]
