from __future__ import annotations

import copy
from pathlib import Path

import pytest

from writ_ingest.corpus.constitutional_law import (
    ConstitutionalImportError,
    build_documents,
    deduplicate_rows,
    import_constitutions,
    render_record,
    row_hash,
    stable_record_id,
)


def source_row() -> dict[str, object]:
    return {
        "act_id": "SCONST_AL_A1_S1",
        "citation": "Ala. Const. art. I, § 1",
        "citation_short": "Ala. Const. art. I, § 1",
        "state": "al",
        "jurisdiction": "US",
        "document_type": "constitution",
        "title_number": None,
        "title_name": "Alabama Constitution",
        "chapter": None,
        "chapter_name": None,
        "section_number": "1",
        "section_title": "Equality and rights of men.",
        "breadcrumb": '["Alabama Constitution", "Article I", "Section 1"]',
        "display_path": "Article I / Section 1",
        "act_status": "in_force",
        "text": "That all men are equally free and independent.",
        "word_count": 9,
        "source_url": "https://example.gov/constitution",
        "last_amended_year": None,
        "subsection_count": 0,
        "cross_references_usc": "[]",
        "cross_references_cfr": "[]",
        "public_laws_referenced": "[]",
        "year": 1901,
    }


def test_only_constitutional_rows_render_as_draft_without_inference() -> None:
    text = render_record(source_row())
    assert "review_state draft;" in text
    assert "force unknown;" in text
    assert "applicability_status unknown;" in text
    assert "enforcement_status unknown;" in text
    assert "adoption_status unknown;" in text
    assert "topics {};" in text
    assert "source_row_identifier" in text
    assert 'dataset_snapshot "v2026.07";' in text
    assert 'source_url "https://example.gov/constitution";' in text
    assert text.count(row_hash(source_row())) == 2

    amendment = {**source_row(), "citation": "U.S. Const. amend. XIII, § 2"}
    assert "instrument_type constitutional_amendment;" in render_record(amendment)


def test_deterministic_ids_are_stable_and_do_not_use_row_order() -> None:
    row = source_row()
    assert stable_record_id(row) == stable_record_id(copy.deepcopy(row))
    assert stable_record_id(row).startswith("us_constitution_al_")


def test_duplicate_rows_do_not_create_duplicate_records() -> None:
    assert len(deduplicate_rows([source_row(), copy.deepcopy(source_row())])) == 1
    documents = build_documents([source_row(), copy.deepcopy(source_row())])
    assert sum(content.count("record us_constitution_") for content in documents.values()) == 1


def test_identifier_collisions_fail_loudly(monkeypatch: pytest.MonkeyPatch) -> None:
    row = source_row()
    changed = {**row, "text": "Different text."}
    monkeypatch.setattr(
        "writ_ingest.corpus.constitutional_law.stable_record_id", lambda *_: "collision"
    )
    with pytest.raises(ConstitutionalImportError, match="collision"):
        deduplicate_rows([row, changed])


def test_dry_run_writes_nothing(tmp_path: Path) -> None:
    report = import_constitutions([source_row()], tmp_path, dry_run=True)
    assert report.wrote_files is False
    assert list(tmp_path.iterdir()) == []


def test_sample_writes_split_native_writ_files(tmp_path: Path) -> None:
    report = import_constitutions([source_row()], tmp_path, sample=1)
    assert report.record_count == 1
    assert report.file_count == 1
    outputs = list(tmp_path.rglob("*.writ"))
    assert len(outputs) == 1
    assert outputs[0].is_relative_to(tmp_path / "states" / "al")


def test_size_gate_stops_before_writing(tmp_path: Path) -> None:
    with pytest.raises(ConstitutionalImportError, match="above"):
        import_constitutions([source_row()], tmp_path, max_bytes=1)
    assert list(tmp_path.iterdir()) == []
