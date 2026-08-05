"""The generated EU/US corpus files are checked byte-for-byte, not structurally.

A generated file is defined by the bytes its serializer emits. Comparing parsed
YAML instead would accept key reordering, re-indentation and re-wrapping — real
drift between the checked-in tree and the generator that produced it.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
import yaml
from writ_ingest.corpus.eu_us_ai_governance import (
    CORPUS_SPECS,
    CorpusMigrationError,
    build_corpus_documents,
    canonical_yaml_bytes,
    write_corpus_documents,
)

ROOT = Path(__file__).resolve().parents[4]


def test_checked_in_bytes_equal_the_canonical_serializer_output() -> None:
    write_corpus_documents(root=ROOT, check=True)
    documents = build_corpus_documents(root=ROOT)
    # One manifest and nine record/ledger files for each of the thirteen corpora.
    assert len(documents) == len(CORPUS_SPECS) * 10 == 130
    for relative_path, value in documents.items():
        assert (ROOT / relative_path).read_bytes() == canonical_yaml_bytes(value)


def test_one_canonical_serializer_is_used_for_generation_and_checking() -> None:
    source = (
        ROOT / "apps/ingest/src/writ_ingest/corpus/eu_us_ai_governance.py"
    ).read_text(encoding="utf-8")
    body = source.split("def write_corpus_documents", 1)[1].split("\ndef ", 1)[0]
    assert "canonical_yaml_bytes(value)" in body
    assert "actual != expected" in body
    # The old structural comparison must not be the check.
    assert "_read_yaml(path) != value:" not in body
    assert source.count("def canonical_yaml_bytes") == 1
    assert source.count("yaml.dump(") == 1


@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    """A copy of the repository tree the generator reads and writes."""

    for relative in ("archive/pilots/eu-us-ai-evaluation-v1", "corpora"):
        shutil.copytree(ROOT / relative, tmp_path / relative)
    (tmp_path / ".git").mkdir()
    write_corpus_documents(root=tmp_path, check=True)
    return tmp_path


def test_a_serialization_only_change_fails_the_generator_check(workspace: Path) -> None:
    target = workspace / CORPUS_SPECS[0]["path"] / "records/claims.yaml"
    original = target.read_bytes()
    parsed = yaml.safe_load(original.decode("utf-8"))

    # Re-emit the identical structure with sorted keys and a different width.
    # Nothing about the content changes; only the serialization does.
    reserialized = yaml.safe_dump(parsed, allow_unicode=True, sort_keys=True, width=60).encode(
        "utf-8"
    )
    assert reserialized != original
    assert yaml.safe_load(reserialized.decode("utf-8")) == parsed

    target.write_bytes(reserialized)
    with pytest.raises(CorpusMigrationError) as raised:
        write_corpus_documents(root=workspace, check=True)
    assert "serialization differs while parsed content matches" in str(raised.value)

    target.write_bytes(original)
    write_corpus_documents(root=workspace, check=True)


def test_key_order_drift_alone_fails_the_generator_check(workspace: Path) -> None:
    target = workspace / CORPUS_SPECS[0]["path"] / "corpus.yaml"
    original = target.read_bytes()
    parsed = yaml.safe_load(original.decode("utf-8"))
    reordered = {key: parsed[key] for key in reversed(list(parsed))}
    assert reordered == parsed

    target.write_bytes(
        yaml.safe_dump(reordered, allow_unicode=True, sort_keys=False, width=100).encode("utf-8")
    )
    with pytest.raises(CorpusMigrationError, match="has drifted"):
        write_corpus_documents(root=workspace, check=True)

    target.write_bytes(original)
    write_corpus_documents(root=workspace, check=True)


def test_a_content_change_still_fails_and_is_reported_as_content(workspace: Path) -> None:
    target = workspace / CORPUS_SPECS[0]["path"] / "records/claims.yaml"
    parsed = yaml.safe_load(target.read_text(encoding="utf-8"))
    parsed["claims"][0]["review_status"] = "draft"
    target.write_bytes(
        yaml.safe_dump(parsed, allow_unicode=True, sort_keys=False, width=100).encode("utf-8")
    )
    with pytest.raises(CorpusMigrationError) as raised:
        write_corpus_documents(root=workspace, check=True)
    assert "content differs" in str(raised.value)


def test_a_missing_generated_file_is_reported_as_missing(workspace: Path) -> None:
    (workspace / CORPUS_SPECS[0]["path"] / "records/claims.yaml").unlink()
    with pytest.raises(CorpusMigrationError, match="is missing"):
        write_corpus_documents(root=workspace, check=True)


def test_regeneration_is_reproducible(workspace: Path) -> None:
    before = {
        path: (workspace / path).read_bytes() for path in build_corpus_documents(root=workspace)
    }
    write_corpus_documents(root=workspace)
    after = {
        path: (workspace / path).read_bytes() for path in build_corpus_documents(root=workspace)
    }
    assert after == before
