#!/usr/bin/env python3
"""Generate or check the legacy JSON projection of the canonical YAML registry."""

from __future__ import annotations

import argparse
from pathlib import Path

from writ_ingest.corpus.registry import (
    REGISTRY_RELATIVE_PATH,
    canonical_json_bytes,
    find_repo_root,
    load_registry,
    project_legacy_registry,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    root = find_repo_root()
    registry_path = args.registry or root / REGISTRY_RELATIVE_PATH
    output_path = args.output or root / "internal/infrastructure/generated/source-registry.json"
    payload = canonical_json_bytes(
        project_legacy_registry(load_registry(registry_path))
    )
    if args.check:
        if not output_path.is_file() or output_path.read_bytes() != payload:
            parser.error(
                f"{output_path} is not synchronized with {registry_path}; regenerate it"
            )
        return 0
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
