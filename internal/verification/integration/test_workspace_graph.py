from __future__ import annotations

import json
from pathlib import Path

import tomllib

ROOT = Path(__file__).resolve().parents[3]
RETIRED = {
    "@writ/analyzer",
    "@writ/api",
    "@writ/benchmark",
    "@writ/conformance",
    "@writ/evaluator",
}
RETIRED_DEPENDENCIES = {"postgres"}
RETIRED_PATHS = {
    ".env.example",
    "apps/api",
    "apps/ingest/src/writ_ingest/corpus/online_store.py",
    "docker-compose.yml",
    "internal/infrastructure/database",
    "internal/tooling/scripts/publish_corpus.ts",
}


def test_retired_packages_are_absent_from_the_workspace_graph() -> None:
    manifests = [ROOT / "package.json"]
    manifests.extend((ROOT / "apps").glob("*/package.json"))
    manifests.extend((ROOT / "packages").glob("*/package.json"))
    manifests.append(ROOT / "internal/verification/writ/package.json")

    names: set[str] = set()
    dependencies: set[str] = set()
    for manifest in manifests:
        parsed = json.loads(manifest.read_text(encoding="utf-8"))
        if isinstance(parsed.get("name"), str):
            names.add(parsed["name"])
        for field in ("dependencies", "devDependencies", "peerDependencies"):
            dependencies.update(parsed.get(field, {}).keys())

    assert RETIRED.isdisjoint(names)
    assert RETIRED.isdisjoint(dependencies)
    assert RETIRED_DEPENDENCIES.isdisjoint(dependencies)


def test_legacy_database_persistence_is_absent_from_current_wiring() -> None:
    assert all(not (ROOT / relative).exists() for relative in RETIRED_PATHS)

    root_package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert {"db:up", "db:down"}.isdisjoint(root_package["scripts"])

    ingest = tomllib.loads((ROOT / "apps/ingest/pyproject.toml").read_text(encoding="utf-8"))
    dependencies = ingest["project"]["dependencies"]
    assert not any(dependency.startswith(("boto3", "psycopg")) for dependency in dependencies)

    workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8")
    assert "migrations:" not in workflow
    assert "postgres:" not in workflow
