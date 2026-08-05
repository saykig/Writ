"""Conformance gates for the permanent native corpus-family architecture."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import jsonschema
import yaml
from writ_ingest.corpus.eu_us_ai_governance import CORPUS_SPECS

ROOT = Path(__file__).resolve().parents[4]
CATALOG_PATH = ROOT / "corpora/catalog.yaml"
PRE_MIGRATION = ROOT / "docs/migrations/corpus-family-foundation/pre-migration-inventory.json"
RETIRED_IDS = {"writ.corpus.eu.ai-governance", "writ.corpus.us.ai-governance"}
NAMESPACE_DIRS = {
    "corpora/legal-policy/eu/european-union",
    "corpora/legal-policy/eu/european-commission",
    "corpora/legal-policy/us/nist",
    "corpora/legal-policy/us/nist/caisi",
    "corpora/legal-policy/us/office-of-management-and-budget",
    "corpora/legal-policy/us/white-house",
}


def load_yaml(path: Path) -> dict[str, Any]:
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def catalog() -> dict[str, Any]:
    return load_yaml(CATALOG_PATH)


def manifest(entry: dict[str, Any]) -> dict[str, Any]:
    return load_yaml(ROOT / entry["manifest"])


def ai_documents(relative: str, key: str) -> list[dict[str, Any]]:
    return [
        value
        for spec in CORPUS_SPECS
        for value in load_yaml(ROOT / spec["path"] / relative)[key]
    ]


def test_catalog_and_manifests_validate_against_core_contracts() -> None:
    catalog_schema = json.loads((ROOT / "schemas/core/corpus-catalog.schema.json").read_text())
    manifest_schema = json.loads((ROOT / "schemas/core/corpus-manifest.schema.json").read_text())
    current = catalog()
    jsonschema.Draft202012Validator(catalog_schema).validate(current)
    assert current["implemented_native_families"] == ["legal_policy", "institutional"]
    assert len(current["corpora"]) == 16
    for entry in current["corpora"]:
        jsonschema.Draft202012Validator(manifest_schema).validate(manifest(entry))


def test_native_paths_have_one_family_and_no_subject_based_boundary() -> None:
    current = catalog()
    ids = [entry["corpus_id"] for entry in current["corpora"]]
    paths = [entry["path"] for entry in current["corpora"]]
    assert len(ids) == len(set(ids))
    assert len(paths) == len(set(paths))
    assert RETIRED_IDS.isdisjoint(ids)
    assert not any(
        segment in {"ai-policy", "ai-governance"}
        for value in [*ids, *paths]
        for segment in re.split(r"[/.]", value)
    )
    for entry in current["corpora"]:
        assert entry["family"] in {"legal_policy", "institutional"}
        assert entry["path"].startswith(f"corpora/{entry['family'].replace('_', '-')}/")
        assert f"/{entry['jurisdiction'].lower()}/" in f"/{entry['path']}/"
        assert manifest(entry)["family"] == entry["family"]


def test_issuer_namespaces_are_not_corpora_and_legal_leaves_are_instrument_scoped() -> None:
    for relative in NAMESPACE_DIRS:
        assert not (ROOT / relative / "corpus.yaml").exists()
    for entry in catalog()["corpora"]:
        current = manifest(entry)
        if entry["family"] == "legal_policy":
            assert sum(
                name in current
                for name in ("instrument_id", "instrument_series_id", "dataset_collection_id")
            ) == 1
        else:
            assert current["root_institution_id"]
        assert {"topic", "topics", "field", "query", "collection", "subject_area"}.isdisjoint(
            current
        )


def test_explicit_claim_mapping_and_review_totals_are_exact() -> None:
    all_claims = ai_documents("records/claims.yaml", "claims")
    all_reviews = ai_documents("reviews/parent-annotations.yaml", "reviews")
    actual = {
        spec["corpus_id"]: {
            claim["legacy_refs"][0]
            for claim in load_yaml(ROOT / spec["path"] / "records/claims.yaml")["claims"]
        }
        for spec in CORPUS_SPECS
    }
    assert actual == {spec["corpus_id"]: set(spec["claims"]) for spec in CORPUS_SPECS}
    assert len(all_claims) == len({claim["machine_id"] for claim in all_claims}) == 32
    assert len(all_reviews) == len({review["machine_id"] for review in all_reviews}) == 24
    assert all(claim["review_status"] == "accepted" for claim in all_claims)
    assert sum(claim["jurisdiction"] == "EU" for claim in all_claims) == 15
    assert sum(claim["jurisdiction"] == "US" for claim in all_claims) == 17


def test_pre_migration_claim_semantics_and_all_object_identities_are_preserved() -> None:
    before = json.loads(PRE_MIGRATION.read_text(encoding="utf-8"))
    claims = ai_documents("records/claims.yaml", "claims")
    normalized = [
        {key: value for key, value in claim.items() if key not in {"family", "corpus_id"}}
        for claim in claims
    ]
    assert {item["machine_id"]: item for item in normalized} == {
        item["machine_id"]: item for item in before["accepted_claims"]
    }

    active_by_kind = {
        "claims": claims,
        "entities": ai_documents("records/entities.yaml", "entities"),
        "passages": ai_documents("passages/passages.yaml", "passages"),
        "relationships": ai_documents("records/relationships.yaml", "relationships"),
        "reviews": ai_documents("reviews/parent-annotations.yaml", "reviews"),
        "sources": ai_documents("sources/sources.yaml", "sources"),
        "unresolved": ai_documents("passages/unresolved.yaml", "unresolved"),
    }
    assert {kind: len(values) for kind, values in active_by_kind.items()} == before["object_counts"]
    active_ids = {
        (kind, record["machine_id"])
        for kind, records in active_by_kind.items()
        for record in records
    }
    before_ids = {(record["kind"], record["machine_id"]) for record in before["identities"]}
    assert active_ids == before_ids


def test_hashes_unresolved_states_and_legacy_references_are_preserved() -> None:
    sources = ai_documents("sources/sources.yaml", "sources")
    passages = ai_documents("passages/passages.yaml", "passages")
    unresolved = ai_documents("passages/unresolved.yaml", "unresolved")
    assert len([source for source in sources if source["verification_status"] == "verified"]) == 10
    assert len([source for source in sources if source["verification_status"] == "unresolved"]) == 3
    assert len(passages) == 22
    assert len(unresolved) == 3
    assert {item["imported_parent_legacy_ref"] for item in unresolved} == {
        "EU-10",
        "EU-12",
        "US-02",
    }
    assert all(source.get("sha256", "").startswith("sha256:") for source in sources if source["verification_status"] == "verified")
    assert all(passage["anchor_hash"].startswith("sha256:") for passage in passages)


def test_migration_ledgers_cover_old_membership_and_relationships_once() -> None:
    ledgers = [load_yaml(ROOT / spec["path"] / "migration-map.yaml") for spec in CORPUS_SPECS]
    entries = [entry for ledger in ledgers for entry in ledger["entries"]]
    moved = [entry for ledger in ledgers for entry in ledger["moved_objects"]]
    assert len(entries) == 38
    assert len({entry["legacy_ref"] for entry in entries}) == 38
    assert all(entry["old_corpus_id"] in RETIRED_IDS for entry in entries)
    relationships = [entry for entry in moved if entry["object_type"] == "relationship"]
    assert len(relationships) == len({entry["machine_id"] for entry in relationships}) == 91


def test_family_source_files_and_workflow_states_remain_separate() -> None:
    legal_nist = ROOT / "corpora/legal-policy/us/nist"
    institutional_nist = ROOT / "corpora/institutional/us/nist"
    assert not (legal_nist / "records.writ").exists()
    assert (institutional_nist / "records.writ").exists()
    assert manifest(next(entry for entry in catalog()["corpora"] if entry["corpus_id"] == "us.constitutional_law"))["family"] == "legal_policy"
    assert manifest(next(entry for entry in catalog()["corpora"] if entry["corpus_id"] == "us.institutions.nist"))["family"] == "institutional"
    nist = (institutional_nist / "records.writ").read_text(encoding="utf-8")
    assert nist.count("\nrecord ") == 6
    assert nist.count("review_state draft;") == 6
    assert nist.count('created_by "OpenAI Codex automated draft";') == 6


def test_nist_constitutional_and_protected_bytes_match_inventory() -> None:
    before = json.loads(PRE_MIGRATION.read_text(encoding="utf-8"))
    nist_bytes = (ROOT / "corpora/institutional/us/nist/records.writ").read_bytes()
    assert hashlib.sha256(nist_bytes).hexdigest() == before["nist"]["sha256"]
    for item in before["constitutional"]:
        old_prefix = "corpora/us/constitutional-law/"
        relative = item["path"].removeprefix(old_prefix)
        current = ROOT / "corpora/legal-policy/us/constitutional-law" / relative
        assert hashlib.sha256(current.read_bytes()).hexdigest() == item["sha256"]


def test_ai_office_records_are_atomic_function_drafts_only() -> None:
    text = (ROOT / "corpora/institutional/eu/european-commission/records.writ").read_text()
    assert text.count("\nrecord ") == 3
    assert text.count("fact_type function;") == 3
    assert text.count("review_state draft;") == 3
    assert "fact_type mandate" not in text
    assert "operational_capacity {" not in text
    assert "mission {" not in text


def test_query_directory_is_not_needed_for_catalog_or_manifest_resolution() -> None:
    for entry in catalog()["corpora"]:
        assert (ROOT / entry["manifest"]).is_file()
        assert not str(entry["manifest"]).startswith("queries/")
