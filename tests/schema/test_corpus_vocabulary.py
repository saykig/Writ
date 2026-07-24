from __future__ import annotations

import copy
from pathlib import Path

import pytest
import yaml
from writ_ingest.corpus.review_queue import make_review_item
from writ_ingest.corpus.validation import CorpusValidationError
from writ_ingest.corpus.vocabulary import (
    load_vocabulary,
    resolve_vocabulary,
    validate_vocabulary_review_items,
)


def write_vocabulary(tmp_path: Path, value: dict[str, object]) -> Path:
    path = tmp_path / "corpus_vocabulary.yml"
    path.write_text(yaml.safe_dump(value, sort_keys=False), encoding="utf-8")
    return path


def test_reviewed_proposed_and_unmapped_states_are_distinct() -> None:
    vocabulary = load_vocabulary()
    reviewed = resolve_vocabulary(
        vocabulary,
        namespace="institution",
        source_id="g7.evaluations.2025.final",
        source_term="G7",
    )
    proposed = resolve_vocabulary(
        vocabulary,
        namespace="issue_area",
        source_id="g7.evaluations.2025.final",
        source_term=(
            "Digital Economy: Artificial Intelligence for Small and Medium-Sized Enterprises"
        ),
    )
    assert reviewed.canonical_term == "G7"
    assert reviewed.requires_review is False
    assert proposed.canonical_term is None
    assert proposed.requires_review is True


def test_reviewed_mapping_requires_reviewer(tmp_path: Path) -> None:
    vocabulary = copy.deepcopy(load_vocabulary())
    vocabulary["mappings"][0]["reviewer_id"] = None
    with pytest.raises(CorpusValidationError):
        load_vocabulary(write_vocabulary(tmp_path, vocabulary))


def test_unmapped_mapping_requires_null_canonical_term(tmp_path: Path) -> None:
    vocabulary = copy.deepcopy(load_vocabulary())
    mapping = vocabulary["mappings"][-1]
    mapping["mapping_status"] = "unmapped"
    mapping["canonical_term"] = "guessed"
    with pytest.raises(CorpusValidationError):
        load_vocabulary(write_vocabulary(tmp_path, vocabulary))


def test_vocabulary_cannot_map_score_terms(tmp_path: Path) -> None:
    vocabulary = copy.deepcopy(load_vocabulary())
    mapping = vocabulary["mappings"][-1]
    mapping["source_term"] = "-1"
    mapping["canonical_term"] = "non_compliance"
    with pytest.raises(CorpusValidationError, match="closed score term"):
        load_vocabulary(write_vocabulary(tmp_path, vocabulary))


def test_proposed_and_unmapped_mappings_require_review_items(tmp_path: Path) -> None:
    vocabulary = copy.deepcopy(load_vocabulary())
    proposed = next(
        mapping
        for mapping in vocabulary["mappings"]
        if mapping["mapping_status"] == "proposed"
    )
    unmapped = {
        **proposed,
        "mapping_id": "g7.2025.instrument.unmapped",
        "namespace": "policy_instrument",
        "source_term": "Source-only instrument term",
        "canonical_term": None,
        "mapping_status": "unmapped",
    }
    vocabulary["mappings"].append(unmapped)
    loaded = load_vocabulary(write_vocabulary(tmp_path, vocabulary))
    with pytest.raises(CorpusValidationError, match="requires a review item"):
        validate_vocabulary_review_items(loaded, [])

    items = [
        make_review_item(
            source_id=mapping["source_id"],
            passage_id=None,
            page_or_section="synthetic vocabulary",
            issue_type=(
                "proposed_vocabulary_mapping"
                if mapping["mapping_status"] == "proposed"
                else "unmapped_vocabulary"
            ),
            parser_version="synthetic-test-2",
            affected_record_ids=[mapping["mapping_id"]],
            original_source_text=mapping["source_term"],
        )
        for mapping in (proposed, unmapped)
    ]
    validate_vocabulary_review_items(loaded, items)
