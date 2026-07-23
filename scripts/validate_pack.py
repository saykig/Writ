#!/usr/bin/env python3
"""Validate the Writ planning pack without modifying governed artifacts."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]

SCHEMA_EXAMPLES = [
    ("specs/source-registry.schema.json", "data/source-registry.json"),
    ("specs/canonical-ir.schema.json", "examples/2025-ai-sme-literal.ir.json"),
    ("specs/evidence.schema.json", "examples/2025-ai-sme.sample-evidence.json"),
    ("specs/evaluation-receipt.schema.json", "examples/2025-ai-sme.sample-receipt.json"),
    ("specs/discrepancy.schema.json", "examples/2025-ai-sme.sample-discrepancy.json"),
    ("specs/interpretation-profile.schema.json", "examples/2025-ai-sme.sample-profile.json"),
    ("specs/search-protocol.schema.json", "examples/2025-ai-sme.sample-search-protocol.json"),
    ("specs/methodology-inventory.schema.json", "examples/2025-ai-sme.methodology-inventory.json"),
    ("specs/release.schema.json", "examples/2025-benchmark.sample-release.json"),
]

REQUIRED_FILES = [
    "README.md",
    "START_HERE.md",
    "AGENTS.md",
    "TASKS.yaml",
    "13_CODEX_MASTER_PROMPT.md",
    ".agents/skills/writ-domain/SKILL.md",
    "reference-core/package.json",
    "repo-scaffold/db/migrations/0001_initial.sql",
    "data/source-registry.json",
]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def validate_required_files() -> None:
    missing = [name for name in REQUIRED_FILES if not (ROOT / name).is_file()]
    if missing:
        fail(f"missing required files: {', '.join(missing)}")


def validate_all_json_syntax() -> None:
    for path in sorted(ROOT.rglob("*.json")):
        if "reference-core/dist" in path.as_posix():
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
        try:
            parsed_yaml[str(path.relative_to(ROOT))] = yaml.safe_load(path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            fail(f"invalid YAML in {path.relative_to(ROOT)}: {exc}")

    tasks = parsed_yaml.get("TASKS.yaml")
    if not isinstance(tasks, dict) or not isinstance(tasks.get("tasks"), list):
        fail("TASKS.yaml does not contain a task list")

    openapi = parsed_yaml.get("specs/openapi.yaml")
    if not isinstance(openapi, dict) or openapi.get("openapi") != "3.1.0":
        fail("specs/openapi.yaml is missing the OpenAPI 3.1.0 marker")
    if not isinstance(openapi.get("paths"), dict) or not isinstance(openapi.get("components"), dict):
        fail("specs/openapi.yaml is missing paths or components")
    ids = [task.get("id") for task in tasks["tasks"]]
    if len(ids) != len(set(ids)):
        fail("TASKS.yaml contains duplicate task IDs")
    known = set(ids)
    for task in tasks["tasks"]:
        missing = [dep for dep in task.get("dependencies", []) if dep not in known]
        if missing:
            fail(f"task {task.get('id')} has unknown dependencies: {missing}")


def validate_text_policy() -> None:
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".md", ".yaml", ".yml", ".json", ".ts", ".py", ".sql", ".toml", ".ebnf", ".langium", ".mmd"}:
            continue
        text = path.read_text(encoding="utf-8")
        if "\u2014" in text:
            fail(f"em dash found in {path.relative_to(ROOT)}")


def run_reference_core() -> None:
    completed = subprocess.run(
        ["npm", "test"],
        cwd=ROOT / "reference-core",
        check=False,
        text=True,
    )
    if completed.returncode != 0:
        fail("reference-core tests failed")


def main() -> None:
    validate_required_files()
    validate_all_json_syntax()
    validate_schemas_and_examples()
    validate_yaml()
    validate_text_policy()
    run_reference_core()
    print("OK: Writ build pack validated")


if __name__ == "__main__":
    main()
