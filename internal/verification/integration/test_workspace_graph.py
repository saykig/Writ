from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
RETIRED = {"@writ/evaluator", "@writ/analyzer", "@writ/benchmark", "@writ/conformance"}


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
