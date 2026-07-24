from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from writ_ingest.corpus.fetch import (
    FetchGateError,
    fetch_live_bytes,
    plan_seed_fetch,
    validate_redirect_chain,
)
from writ_ingest.corpus.manifest import (
    ManifestError,
    build_blocked_seed_manifest,
    build_discovered_manifest,
    write_immutable_json,
)
from writ_ingest.corpus.online_store import OnlineStoreError, prepare_online_artifact
from writ_ingest.corpus.registry import (
    RegistryNotFoundError,
    RegistryValidationError,
    UrlPolicyError,
    canonical_json_bytes,
    get_source,
    load_registry,
    project_legacy_registry,
)
from writ_ingest.corpus.validation import validate_record

ROOT = Path(__file__).resolve().parents[2]


def g20_source() -> dict[str, object]:
    return get_source(load_registry(), "g20_research_group")


def test_registry_is_canonical_and_generated_json_is_synchronized() -> None:
    registry = load_registry()
    assert registry["sources"][0]["id"] == "g20_research_group"
    assert len(registry["sources"]) == 104
    expected = canonical_json_bytes(project_legacy_registry(registry))
    assert (ROOT / "data/source-registry.json").read_bytes() == expected


def test_missing_and_unregistered_sources_fail(tmp_path: Path) -> None:
    with pytest.raises(RegistryNotFoundError, match="missing"):
        load_registry(tmp_path / "missing.yml")
    with pytest.raises(Exception, match="unregistered source"):
        get_source(load_registry(), "not.registered")


def test_duplicate_ids_and_seed_outside_allowlist_fail(tmp_path: Path) -> None:
    registry = load_registry()
    duplicate = {
        "schema_version": "1.0.0",
        "sources": [registry["sources"][0], registry["sources"][0]],
    }
    duplicate_path = tmp_path / "duplicate.yml"
    duplicate_path.write_text(yaml.safe_dump(duplicate), encoding="utf-8")
    with pytest.raises(RegistryValidationError, match="duplicate source ids"):
        load_registry(duplicate_path)

    outside = json.loads(json.dumps(registry))
    outside["sources"][0]["discovery"]["seed_url"] = (
        "https://example.invalid/index.html"
    )
    outside["sources"][0]["base_uri"] = "https://example.invalid/index.html"
    outside_path = tmp_path / "outside.yml"
    outside_path.write_text(yaml.safe_dump(outside), encoding="utf-8")
    with pytest.raises(RegistryValidationError, match="not in the source allowlist"):
        load_registry(outside_path)


def test_url_policy_is_exact_and_fragment_is_transport_metadata() -> None:
    source = g20_source()
    plan = plan_seed_fetch(source)
    assert plan["request_url"].endswith("/analysis/index.html")
    assert "#" not in plan["request_url"]
    assert plan["section_anchor"] == "commitments"
    assert validate_redirect_chain(
        source,
        [
            "https://www.g20.utoronto.ca/analysis/index.html",
            "https://g20.utoronto.ca/compliance/index.html",
        ],
    )
    with pytest.raises(UrlPolicyError):
        validate_redirect_chain(
            source, ["https://www.g20.utoronto.ca.example.invalid/x"]
        )
    with pytest.raises(UrlPolicyError):
        validate_redirect_chain(
            source, ["https://www.g7.utoronto.ca/compliance/manual.pdf"]
        )


def test_blocked_manifest_is_deterministic_and_immutable(tmp_path: Path) -> None:
    source = g20_source()
    first = build_blocked_seed_manifest(
        source, summit_slug="2024-rio", observed_at="2026-07-24"
    )
    second = build_blocked_seed_manifest(
        source, summit_slug="2024-rio", observed_at="2026-07-24"
    )
    assert first == second
    assert first["raw_files_available"] is False
    assert first["documents"][0]["fetch_status"] == "blocked"
    validate_record("source_manifest", first)

    path = tmp_path / "source-manifest.json"
    assert write_immutable_json(path, first) is True
    assert write_immutable_json(path, second) is False
    changed = {**first, "summit_slug": "2025-synthetic"}
    with pytest.raises(ManifestError, match="refusing to overwrite"):
        write_immutable_json(path, changed)


def test_online_raw_artifact_identity_is_content_addressed() -> None:
    first = prepare_online_artifact(
        logical_id="corpus.g20.synthetic.document",
        source_id="g20_research_group",
        object_kind="raw_source",
        content=b"<html>synthetic one</html>",
        media_type="text/html",
        summit_slug="2024-rio",
        provenance={"fixture": "synthetic"},
    )
    second = prepare_online_artifact(
        logical_id="corpus.g20.synthetic.document",
        source_id="g20_research_group",
        object_kind="raw_source",
        content=b"<html>synthetic one</html>",
        media_type="text/html",
        summit_slug="2024-rio",
        provenance={"fixture": "synthetic"},
    )
    assert first == second
    changed = prepare_online_artifact(
        logical_id="corpus.g20.synthetic.document",
        source_id="g20_research_group",
        object_kind="raw_source",
        content=b"<html>synthetic two</html>",
        media_type="text/html",
        summit_slug="2024-rio",
        provenance={"fixture": "synthetic"},
    )
    assert changed.sha256 != first.sha256
    assert changed.object_id != first.object_id
    with pytest.raises(OnlineStoreError, match="non-empty"):
        prepare_online_artifact(
            logical_id="corpus.g20.synthetic.empty",
            source_id="g20_research_group",
            object_kind="raw_source",
            content=b"",
            media_type="text/html",
            provenance={"fixture": "synthetic"},
        )


def test_synthetic_html_discovery_uses_registered_sections_only() -> None:
    source = g20_source()
    html = b"""
      <a name="commitments"></a>
      <h2>Commitments</h2>
      <a href="/analysis/allowed.html">Allowed</a>
      <a href="https://example.invalid/rejected.html">Rejected</a>
      <a name="commentary"></a>
      <h2>Commentary</h2>
      <a href="/analysis/not-included.html">Not included</a>
    """
    manifest = build_discovered_manifest(source, summit_slug="2024-rio", seed_html=html)
    assert len(manifest["documents"]) == 1
    assert manifest["documents"][0]["source_url"].endswith("/analysis/allowed.html")
    assert "human_manifest_review_required" in manifest["documents"][0]["warnings"]
    validate_record("source_manifest", manifest)


def test_live_fetch_is_gated_before_network() -> None:
    with pytest.raises(FetchGateError, match="explicit"):
        fetch_live_bytes(
            source=g20_source(),
            source_url="https://www.g20.utoronto.ca/analysis/index.html",
            approved_live_access=False,
        )
