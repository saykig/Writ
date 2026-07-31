from __future__ import annotations

from pathlib import Path

from writ_ingest.corpus.adapters.g7_2025_ai_sme import G7AiSmeFixtureAdapter
from writ_ingest.corpus.adapters.g20 import G20RioAdapter
from writ_ingest.corpus.validation import validate_corpus_graph
from writ_ingest.corpus.vocabulary import (
    load_vocabulary,
    validate_vocabulary_review_items,
)


def test_g7_fixture_adapter_emits_normalized_records_in_memory() -> None:
    output = G7AiSmeFixtureAdapter().emit()
    assert len(output.commitments) == 1
    assert len(output.selections) == 1
    assert len(output.reports) == 1
    assert len(output.member_assessments) == 8
    assert len(output.reconciliations) == 0
    assert all(item["institution"] == "G7" for item in output.commitments)
    assert all("institution" not in item for item in output.member_assessments)
    assert all("report_stage" not in item for item in output.member_assessments)
    assert all("assessment_window_start" not in item for item in output.member_assessments)
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
    validate_vocabulary_review_items(load_vocabulary(), list(output.review_items))


def test_g20_rio_adapter_is_implemented() -> None:
    output = G20RioAdapter().emit()
    assert len(output.commitments) == 13
    assert len(output.reports) == 2
    assert all(item["institution"] == "G20" for item in output.commitments)


def test_rio_records_stay_out_of_the_data_tree() -> None:
    # Authoritative records and source bytes live in the multilateral corpus.
    # The internal generated tree is reserved for compatibility cache/output.
    root = Path(__file__).resolve().parents[4]
    assert not (root / "internal/infrastructure/generated/raw/g20").exists()
    assert not (root / "internal/infrastructure/generated/normalized/g20").exists()
