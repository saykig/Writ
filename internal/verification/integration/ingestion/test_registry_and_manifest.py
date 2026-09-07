from __future__ import annotations

import hashlib
import json
import subprocess
import sys
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
from writ_ingest.corpus.registry import (
    RegistryNotFoundError,
    RegistryValidationError,
    UrlPolicyError,
    canonical_json_bytes,
    get_source,
    load_registry,
    project_source_registry,
)
from writ_ingest.corpus.validation import validate_record

ROOT = Path(__file__).resolve().parents[4]


def g20_source() -> dict[str, object]:
    return get_source(load_registry(), "g20_research_group")


def test_registry_is_canonical_and_generated_json_is_synchronized() -> None:
    registry = load_registry()
    assert registry["sources"][0]["id"] == "g20_research_group"
    assert len(registry["sources"]) == 107
    assert registry["sources"][-1]["id"] == "writ.controlled_topics"
    expected = canonical_json_bytes(project_source_registry(registry))
    assert (
        ROOT / "internal/infrastructure/generated/source-registry.json"
    ).read_bytes() == expected


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


def test_fetch_cli_writes_exact_bytes_only_to_an_explicit_output(tmp_path: Path) -> None:
    payload = b"<html>synthetic source bytes\r\n</html>"
    supplied = tmp_path / "supplied.html"
    supplied.write_bytes(payload)
    output = tmp_path / "acquired.html"
    command = [
        sys.executable,
        str(ROOT / "internal/tooling/scripts/fetch_sources.py"),
        "--source-id",
        "g20_research_group",
        "--supplied-file",
        str(supplied),
    ]

    missing_output = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert missing_output.returncode == 2
    assert "--output is required" in missing_output.stderr

    acquired = subprocess.run(
        [*command, "--output", str(output)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    report = json.loads(acquired.stdout)
    assert output.read_bytes() == payload
    assert report["sha256"] == f"sha256:{hashlib.sha256(payload).hexdigest()}"
    assert report["byte_size"] == len(payload)
    assert report["acquisition_provenance"] == {
        "acquisition_method": "user_supplied_file",
        "source_url": "https://www.g20.utoronto.ca/analysis/index.html",
        "live_fetch_authorized": False,
    }
    assert report["corpus_objects_written"] is False
    assert report["evidence_accepted"] is False

    overwrite = subprocess.run(
        [*command, "--output", str(output)],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert overwrite.returncode == 2
    assert "refusing to overwrite" in overwrite.stderr
    assert output.read_bytes() == payload


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
