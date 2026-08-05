"""Narrow integrity gates for the archived G7 and G20 compatibility datasets.

These datasets are not native corpora. They are frozen historical material held
outside `corpora/`, and the only guarantees asserted here are that their bytes are
unchanged, their counts are unchanged, and no active corpus resolver reaches them.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[4]
PRE_MIGRATION = ROOT / "docs/migrations/corpus-family-foundation/pre-migration-inventory.json"
G7 = ROOT / "archive/compatibility/g7/2025-ai-sme"
G20 = ROOT / "archive/compatibility/g20/2024-rio"
OLD_PATHS = ("corpora/multilateral/g7/2025-ai-sme", "corpora/multilateral/g20/2024-rio")


def tree_digest(path: Path) -> tuple[int, str]:
    """Digest tree-relative paths and file bytes, exactly as the inventory records it."""

    files = sorted(item for item in path.rglob("*") if item.is_file())
    digest = hashlib.sha256()
    for item in files:
        digest.update(item.relative_to(path).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(item.read_bytes())
        digest.update(b"\0")
    return len(files), digest.hexdigest()


def test_archived_datasets_are_byte_identical_to_the_recorded_inventory() -> None:
    protected = json.loads(PRE_MIGRATION.read_text(encoding="utf-8"))["protected_trees"]
    for key, path in (("g7", G7), ("g20", G20)):
        files, digest = tree_digest(path)
        assert files == protected[key]["files"]
        assert digest == protected[key]["sha256"], f"{key} archive bytes changed"


def test_archived_record_counts_and_coverage_are_unchanged() -> None:
    def records(base: Path, name: str) -> list[Any]:
        return json.loads((base / name).read_text(encoding="utf-8"))

    assert len(records(G7, "records/actors.json")) == 8
    assert len(records(G7, "records/actions.json")) == 87
    assert len(records(G7, "records/political-statements.json")) == 1
    assert len(records(G7, "records/published-judgments.json")) == 8
    assert len(records(G7, "reviews/action-reviews.json")) == 87

    assert len(records(G20, "records/political-statements.json")) == 13
    assert len(records(G20, "records/assessment-selections.json")) == 13
    assert len(records(G20, "records/published-judgments.json")) == 546

    g20_manifest = yaml.safe_load((G20 / "corpus.yaml").read_text(encoding="utf-8"))
    coverage = g20_manifest["coverage"]
    assert coverage["expected_statement_inventory"] == 174
    assert coverage["ingested_statements"] == 13
    assert coverage["status"] == "incomplete"
    assert coverage["missing_records_fabricated"] is False


def test_archived_datasets_are_outside_the_active_corpus_architecture() -> None:
    catalog = yaml.safe_load((ROOT / "corpora/catalog.yaml").read_text(encoding="utf-8"))
    paths = {entry["path"] for entry in catalog["native_corpora"]}
    assert all(path.startswith("corpora/") for path in paths)
    assert not any("g7" in path or "g20" in path or "multilateral" in path for path in paths)
    for old in OLD_PATHS:
        assert not (ROOT / old).exists()
    assert not (ROOT / "corpora/multilateral").exists()


def test_archived_manifests_are_not_native_corpus_manifests() -> None:
    """Their compliance-oriented shape must not leak into the native manifest contract."""

    for base in (G7, G20):
        current = yaml.safe_load((base / "corpus.yaml").read_text(encoding="utf-8"))
        assert "family" not in current
        assert "record_contract" not in current
        assert "locations" not in current
        assert "authority" in current
