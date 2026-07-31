#!/usr/bin/env python3
"""Validate Writ schemas, protocols, fixtures, tasks, and conformance cases."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[3]
G7_COMPAT = "internal/verification/fixtures/compatibility/g7-ai-sme/schemas"
IGNORED_DIRECTORY_NAMES = {
    ".git",
    ".mypy_cache",
    ".next",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
}

SCHEMA_EXAMPLES = [
    (
        "schemas/core/source-registry.schema.json",
        "internal/infrastructure/generated/source-registry.json",
    ),
    ("schemas/analysis/canonical-ir.schema.json", f"{G7_COMPAT}/2025-ai-sme-literal.ir.json"),
    ("schemas/core/evidence.schema.json", f"{G7_COMPAT}/2025-ai-sme.sample-evidence.json"),
    (
        "schemas/analysis/evaluation-receipt.schema.json",
        f"{G7_COMPAT}/2025-ai-sme.sample-receipt.json",
    ),
    ("schemas/analysis/discrepancy.schema.json", f"{G7_COMPAT}/2025-ai-sme.sample-discrepancy.json"),
    (
        "schemas/analysis/interpretation-profile.schema.json",
        f"{G7_COMPAT}/2025-ai-sme.sample-profile.json",
    ),
    (
        "schemas/analysis/search-protocol.schema.json",
        f"{G7_COMPAT}/2025-ai-sme.sample-search-protocol.json",
    ),
    (
        "schemas/compatibility/g7-benchmark-v1/methodology-inventory.schema.json",
        f"{G7_COMPAT}/2025-ai-sme.methodology-inventory.json",
    ),
    ("schemas/analysis/release.schema.json", f"{G7_COMPAT}/2025-benchmark.sample-release.json"),
]

REQUIRED_FILES = [
    "README.md",
    "AGENTS.md",
    "TASKS.yaml",
    "schemas/README.md",
    "protocols/language/writ.ebnf",
    "protocols/api/openapi.yaml",
    ".agents/skills/writ-domain/SKILL.md",
    "internal/verification/conformance/case.schema.json",
    "internal/infrastructure/generated/source-registry.json",
]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def is_repository_source(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not any(part in IGNORED_DIRECTORY_NAMES for part in relative.parts)


def validate_required_files() -> None:
    missing = [name for name in REQUIRED_FILES if not (ROOT / name).is_file()]
    if missing:
        fail(f"missing required files: {', '.join(missing)}")


def validate_all_json_syntax() -> None:
    for path in sorted(ROOT.rglob("*.json")):
        if not is_repository_source(path):
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")


def validate_schemas_and_examples() -> None:
    for schema_rel, example_rel in SCHEMA_EXAMPLES:
        schema = json.loads((ROOT / schema_rel).read_text(encoding="utf-8"))
        example = json.loads((ROOT / example_rel).read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        errors = sorted(validator.iter_errors(example), key=lambda item: list(item.path))
        if errors:
            rendered = "; ".join(f"{list(error.path)}: {error.message}" for error in errors[:10])
            fail(f"{example_rel} failed {schema_rel}: {rendered}")


def validate_yaml() -> None:
    parsed_yaml: dict[str, object] = {}
    for path in sorted([*ROOT.rglob("*.yaml"), *ROOT.rglob("*.yml")]):
        if not is_repository_source(path):
            continue
        try:
            parsed_yaml[str(path.relative_to(ROOT))] = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(f"invalid YAML in {path.relative_to(ROOT)}: {exc}")

    tasks = parsed_yaml.get("TASKS.yaml")
    if not isinstance(tasks, dict) or not isinstance(tasks.get("tasks"), list):
        fail("TASKS.yaml does not contain a task list")

    openapi = parsed_yaml.get("protocols/api/openapi.yaml")
    if not isinstance(openapi, dict) or openapi.get("openapi") != "3.1.0":
        fail("protocols/api/openapi.yaml is missing the OpenAPI 3.1.0 marker")
    if not isinstance(openapi.get("paths"), dict) or not isinstance(openapi.get("components"), dict):
        fail("protocols/api/openapi.yaml is missing paths or components")
    ids = [task.get("id") for task in tasks["tasks"]]
    if len(ids) != len(set(ids)):
        fail("TASKS.yaml contains duplicate task IDs")
    known = set(ids)
    for task in tasks["tasks"]:
        missing = [dep for dep in task.get("dependencies", []) if dep not in known]
        if missing:
            fail(f"task {task.get('id')} has unknown dependencies: {missing}")


def run_conformance() -> None:
    bun = os.environ.get("BUN_BIN") or shutil.which("bun")
    if bun is None:
        fallback = Path.home() / ".bun" / "bin" / "bun"
        bun = str(fallback) if fallback.is_file() else None
    if bun is None:
        fail("Bun executable not found; set BUN_BIN or install Bun")
    completed = subprocess.run(
        [bun, "run", "conformance"],
        cwd=ROOT,
        check=False,
        text=True,
    )
    if completed.returncode != 0:
        fail("conformance tests failed")


def main() -> None:
    validate_required_files()
    validate_all_json_syntax()
    validate_schemas_and_examples()
    validate_yaml()
    run_conformance()
    print("OK: Writ build pack validated")


if __name__ == "__main__":
    main()
