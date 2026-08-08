"""Conformance gates for the permanent native corpus-family architecture."""

from __future__ import annotations

import base64
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import jsonschema
import yaml
from writ_ingest.corpus.eu_us_ai_governance import BOUNDARY_KEYS, CORPUS_SPECS

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


def nist_record_ids(text: str) -> list[str]:
    return re.findall(r"^record (\S+) :", text, re.MULTILINE)


def publication_token(document_id: str) -> str:
    """The publication identifier derived from a registered source document ID."""

    return document_id.upper().replace("-", "_")


def test_catalog_and_manifests_validate_against_core_contracts() -> None:
    catalog_schema = json.loads((ROOT / "schemas/core/corpus-catalog.schema.json").read_text())
    manifest_schema = json.loads((ROOT / "schemas/core/corpus-manifest.schema.json").read_text())
    current = catalog()
    jsonschema.Draft202012Validator(catalog_schema).validate(current)
    assert current["implemented_native_families"] == ["legal_policy", "institutional"]
    assert len(current["native_corpora"]) == 16
    for entry in current["native_corpora"]:
        jsonschema.Draft202012Validator(manifest_schema).validate(manifest(entry))


def test_native_paths_have_one_family_and_no_subject_based_boundary() -> None:
    current = catalog()
    ids = [entry["corpus_id"] for entry in current["native_corpora"]]
    paths = [entry["path"] for entry in current["native_corpora"]]
    assert len(ids) == len(set(ids))
    assert len(paths) == len(set(paths))
    assert RETIRED_IDS.isdisjoint(ids)
    assert not any(
        segment in {"ai-policy", "ai-governance"}
        for value in [*ids, *paths]
        for segment in re.split(r"[/.]", value)
    )
    for entry in current["native_corpora"]:
        assert entry["family"] in {"legal_policy", "institutional"}
        assert entry["path"].startswith(f"corpora/{entry['family'].replace('_', '-')}/")
        assert f"/{entry['jurisdiction'].lower()}/" in f"/{entry['path']}/"
        assert manifest(entry)["family"] == entry["family"]


def test_issuer_namespaces_are_not_corpora_and_legal_leaves_are_instrument_scoped() -> None:
    for relative in NAMESPACE_DIRS:
        assert not (ROOT / relative / "corpus.yaml").exists()
    for entry in catalog()["native_corpora"]:
        current = manifest(entry)
        if entry["family"] == "legal_policy":
            assert sum(name in current for name in BOUNDARY_KEYS) == 1
        else:
            assert current["root_institution_id"]
        assert {"topic", "topics", "field", "query", "collection", "subject_area"}.isdisjoint(
            current
        )


def test_manifests_declare_the_contract_their_records_actually_satisfy() -> None:
    """The manifest names a real contract and says whether it is native or preserved.

    The record files themselves are validated against the declared contract by
    `packages/language/test/corpus-record-contracts.test.ts`, which can compile the
    `.writ` corpora as well as read the YAML ones.
    """

    reviewed_contract = (
        "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1"
        "/reviewed-corpus-document.schema.json"
    )
    grammar_v01 = "https://writ.example/schemas/compatibility/record-grammar-v0.1"
    expected = {
        # The reviewed EU/US payload is a preserved compatibility format.
        **{
            spec["corpus_id"]: ("compatibility", reviewed_contract, "1.0.0")
            for spec in CORPUS_SPECS
        },
        "us.constitutional_law": (
            "compatibility",
            f"{grammar_v01}/legal-policy-record.schema.json",
            "0.1.0",
        ),
        # Stage A moved the NIST corpus onto the native atomic contract.
        "us.institutions.nist": (
            "native",
            "https://writ.example/schemas/extensions/institutional-record.schema.json",
            "0.2.0",
        ),
        "eu.institutions.european_commission": (
            "native",
            "https://writ.example/schemas/extensions/institutional-record.schema.json",
            "0.2.0",
        ),
    }
    actual = {}
    for entry in catalog()["native_corpora"]:
        contract = manifest(entry)["record_contract"]
        actual[entry["corpus_id"]] = (contract["kind"], contract["id"], contract["version"])
        assert "record_schema" not in manifest(entry)
        relative = contract["id"].removeprefix("https://writ.example/")
        assert (ROOT / relative).is_file(), f"{entry['corpus_id']} names a missing contract"
        assert (contract["kind"] == "compatibility") == relative.startswith(
            "schemas/compatibility/"
        )
    assert actual == expected


def test_legal_policy_boundaries_describe_what_each_corpus_actually_captures() -> None:
    """A boundary identifier must be a registered publication or a preserved label.

    A corpus may not name an underlying legal instrument it does not contain. The
    White House fact sheets do not register Executive Order 14179 or the framework
    itself, and the signatory-notice corpus does not contain the Code of Practice,
    so all four declare the publication they actually captured.
    """

    for entry in catalog()["native_corpora"]:
        current = manifest(entry)
        if entry["family"] != "legal_policy":
            continue
        declared = [name for name in BOUNDARY_KEYS if name in current]
        assert len(declared) == 1
        key, value = declared[0], current[declared[0]]
        if key == "dataset_collection_id":
            continue

        base = ROOT / entry["path"]
        sources = load_yaml(base / "sources/sources.yaml")["sources"]
        documents = {
            publication_token(source["document_id"])
            for source in sources
            if source["verification_status"] == "verified"
        }
        labels = {claim["instrument"] for claim in load_yaml(base / "records/claims.yaml")["claims"]}

        if key == "publication_id":
            # A publication boundary tracks the registered document, or the
            # preserved label when the source itself is still unresolved.
            assert value in documents or (not documents and value in labels), (
                f"{entry['corpus_id']} declares publication {value}, "
                f"registered documents are {sorted(documents)}"
            )
        else:
            # An instrument boundary must be an instrument the corpus preserves.
            assert value in labels or value in documents, (
                f"{entry['corpus_id']} declares instrument {value}, which is neither a "
                f"registered document {sorted(documents)} nor a preserved claim label "
                f"{sorted(labels)}"
            )


def test_corrected_publication_boundaries_are_the_documents_on_file() -> None:
    corrected = {
        "writ.corpus.legal-policy.eu.european-commission.gpai-code-of-practice-signatory-notice": (
            "GPAI_CODE_OF_PRACTICE_SIGNATORY_NOTICE"
        ),
        "writ.corpus.legal-policy.us.white-house.ai-leadership-fact-sheet-2025-01": (
            "WH_FACT_SHEET_2025_01_AI_LEADERSHIP"
        ),
        "writ.corpus.legal-policy.us.white-house.national-ai-policy-framework-fact-sheet-2025-12": (
            "WH_FACT_SHEET_2025_12_NATIONAL_FRAMEWORK"
        ),
        "writ.corpus.legal-policy.us.white-house.americas-ai-action-plan": (
            "WH_AMERICAS_AI_ACTION_PLAN"
        ),
        "writ.corpus.legal-policy.us.nist.caisi.overview": "CAISI_OVERVIEW",
        "writ.corpus.legal-policy.us.nist.caisi.guidelines": "CAISI_GUIDELINES",
    }
    by_id = {entry["corpus_id"]: manifest(entry) for entry in catalog()["native_corpora"]}
    for corpus_id, publication in corrected.items():
        current = by_id[corpus_id]
        assert current["publication_id"] == publication
        assert "instrument_id" not in current
        assert "instrument_series_id" not in current

    # The specific overclaims this correction removes.
    declared = {
        value
        for current in by_id.values()
        for key, value in current.items()
        if key in BOUNDARY_KEYS
    }
    assert "GPAI_CODE_OF_PRACTICE" not in declared
    assert "EXECUTIVE_ORDER_14179" not in declared
    assert "NATIONAL_AI_POLICY_FRAMEWORK" not in declared


def test_active_and_alias_identifiers_resolve_uniquely() -> None:
    current = catalog()
    entries = current["native_corpora"]
    ids = [entry["corpus_id"] for entry in entries]
    assert len(ids) == len(set(ids))

    aliases: dict[str, str] = {}
    for entry in entries:
        for alias in manifest(entry)["migration_aliases"]:
            assert alias not in ids, f"{alias} is both an alias and an active corpus ID"
            assert alias not in aliases, (
                f"{alias} is declared by both {aliases[alias]} and {entry['corpus_id']}"
            )
            aliases[alias] = entry["corpus_id"]

    # The retired one-to-many IDs are absent from every leaf alias list.
    assert RETIRED_IDS.isdisjoint(aliases)
    assert all(not manifest(entry)["migration_aliases"] for entry in entries[:13])


def test_retired_corpora_are_a_migration_ledger_and_never_an_active_alias() -> None:
    current = catalog()
    migrations = current["retired_corpus_migrations"]
    active = {entry["corpus_id"] for entry in current["native_corpora"]}
    retired = {migration["retired_corpus_id"] for migration in migrations}

    assert retired == RETIRED_IDS
    assert retired.isdisjoint(active)
    assert len(migrations) == len(retired)

    covered: set[str] = set()
    for migration in migrations:
        replacements = migration["replacement_corpus_ids"]
        # The mapping is one-to-many, so it cannot function as an ID-to-path alias.
        assert len(replacements) > 1
        assert len(replacements) == len(set(replacements))
        assert set(replacements) <= active
        assert migration["old_path"].startswith("corpora/jurisdictions/")
        assert not (ROOT / migration["old_path"]).exists()
        covered |= set(replacements)

    # Every retired corpus is fully covered: each of the thirteen split corpora
    # appears in exactly one ledger entry, and every migration ledger entry in the
    # corpora themselves points back at a recorded retired corpus.
    assert covered == {spec["corpus_id"] for spec in CORPUS_SPECS}
    assert len(covered) == 13
    ledger_old_ids = {
        entry["old_corpus_id"]
        for spec in CORPUS_SPECS
        for entry in load_yaml(ROOT / spec["path"] / "migration-map.yaml")["entries"]
    }
    assert ledger_old_ids == RETIRED_IDS


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
    by_id = {entry["corpus_id"]: entry for entry in catalog()["native_corpora"]}
    assert manifest(by_id["us.constitutional_law"])["family"] == "legal_policy"
    assert manifest(by_id["us.institutions.nist"])["family"] == "institutional"
    nist = (institutional_nist / "records.writ").read_text(encoding="utf-8")
    assert nist.count("\nrecord ") == 15
    # Stage A dispositioned its six drafts, and the completed Stage B human review
    # approved the nine later proposals without changing the superseded Stage A record.
    assert nist.count("review_state draft;") == 0
    assert nist.count("review_state approved;") == 14
    assert nist.count("review_state superseded;") == 1
    # The Stage A provenance remains intact and Stage B implementation provenance is separate.
    assert nist.count('created_by "OpenAI Codex automated draft";') == 5
    assert nist.count('created_by "Claude Code implementation of approved human review";') == 1
    assert nist.count('created_by "OpenAI Codex automated proposal";') == 9
    # `accepted` is a judgment status, never a record or record-link review state.
    assert "review_state accepted" not in nist


def test_constitutional_bytes_match_inventory_and_nist_identities_survive_stage_a() -> None:
    """Stage A rewrote the NIST records by approved review, so their bytes moved.

    What must not move is the identity and evidence layer. The byte freeze recorded in
    the corpus-family inventory is therefore replaced here by the Stage A preservation
    check; `packages/language/test/nist-stage-a.test.ts` asserts the same identities
    against the compiled records.
    """

    before = json.loads(PRE_MIGRATION.read_text(encoding="utf-8"))
    stage_a = json.loads(
        (ROOT / "docs/migrations/nist-stage-a/pre-implementation-inventory.json").read_text(
            encoding="utf-8"
        )
    )
    nist = (ROOT / "corpora/institutional/us/nist/records.writ").read_text(encoding="utf-8")

    # Every record ID and every evidence hash recorded before Stage A is still present.
    assert {item["record_id"] for item in stage_a["records"]} - {
        "nist_department_of_commerce_relationship"
    } <= set(nist_record_ids(nist))
    for value in before["nist"]["hashes"]:
        assert value in nist, f"Stage A dropped evidence hash {value}"

    # The relationship record became a Core link rather than being deleted.
    link = ROOT / (
        "corpora/institutional/us/nist/relationships/"
        "nist_department_of_commerce_relationship.yaml"
    )
    assert link.is_file()
    assert load_yaml(link)["link_id"] == "nist_department_of_commerce_relationship"

    # Stage B appends official sources while preserving the complete Stage A file as a prefix.
    stage_b = json.loads(
        (ROOT / "docs/migrations/institutional-stage-b/pre-implementation-inventory.json").read_text(
            encoding="utf-8"
        )
    )
    sources = (ROOT / "corpora/institutional/us/nist/sources.writ").read_bytes()
    preserved = base64.b64decode(stage_b["nist_stage_a"]["sources_file"]["bytes_base64"])
    assert sources.startswith(preserved)

    for item in before["constitutional"]:
        old_prefix = "corpora/us/constitutional-law/"
        relative = item["path"].removeprefix(old_prefix)
        current = ROOT / "corpora/legal-policy/us/constitutional-law" / relative
        assert hashlib.sha256(current.read_bytes()).hexdigest() == item["sha256"]


def test_ai_office_records_are_atomic_approved_records() -> None:
    text = (ROOT / "corpora/institutional/eu/european-commission/records.writ").read_text()
    assert text.count("\nrecord ") == 20
    assert text.count("fact_type function;") == 7
    assert text.count("review_state draft;") == 0
    assert text.count("review_state approved;") == 20
    assert text.count("fact_type mandate;") == 2
    assert text.count("fact_type decision_right;") == 3
    assert text.count("fact_type operational_capacity;") == 3
    assert text.count("fact_type mission;") == 2


def test_query_directory_is_not_needed_for_catalog_or_manifest_resolution() -> None:
    for entry in catalog()["native_corpora"]:
        assert (ROOT / entry["manifest"]).is_file()
        assert not str(entry["manifest"]).startswith("queries/")


def test_catalog_lists_only_native_family_governed_corpora() -> None:
    current = catalog()
    assert set(current) == {
        "schema_version",
        "implemented_native_families",
        "native_corpora",
        "retired_corpus_migrations",
    }
    for entry in current["native_corpora"]:
        assert entry["family"] in {"legal_policy", "institutional"}
        assert entry["path"].startswith("corpora/")
        assert not entry["path"].startswith("archive/")
    # The archived compatibility datasets are not resolvable through the catalog.
    text = CATALOG_PATH.read_text(encoding="utf-8")
    assert "g7" not in text
    assert "g20" not in text
    assert not (ROOT / "corpora/multilateral").exists()
