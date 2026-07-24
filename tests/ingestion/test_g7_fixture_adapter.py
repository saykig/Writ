from __future__ import annotations

from pathlib import Path

import pytest
from writ_ingest.corpus.adapters.g7_2025_ai_sme import G7AiSmeFixtureAdapter
from writ_ingest.corpus.adapters.g20 import (
    G20Adapter,
    G20AdapterUnavailableError,
)
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


def test_g20_adapter_remains_unimplemented_and_fetch_disabled() -> None:
    with pytest.raises(G20AdapterUnavailableError, match="fetch-disabled"):
        G20Adapter().emit()


def test_schema_migration_creates_no_rio_corpus_records() -> None:
    root = Path(__file__).resolve().parents[2]
    assert [path.name for path in (root / "data/raw/g20").iterdir()] == ["README.md"]
    assert [path.name for path in (root / "data/normalized/g20").iterdir()] == [
        "README.md"
    ]
    manifest = (root / "data/manifests/g20/2024-rio/source-manifest.json").read_text(
        encoding="utf-8"
    )
    assert '"fetch_status": "blocked"' in manifest
    assert '"live_fetch_authorized": false' in manifest
