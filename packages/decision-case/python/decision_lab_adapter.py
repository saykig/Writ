"""Fixed subprocess bridge to the pinned Writ Decision Lab Build 2 interface."""

from __future__ import annotations

import base64
from collections.abc import Mapping
import json
import sys


def _decode(value: object, field: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError(f"{field}_must_be_base64")
    return base64.b64decode(value, validate=True)


def _plain(value: object) -> object:
    if isinstance(value, Mapping):
        return {key: _plain(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_plain(item) for item in value]
    if isinstance(value, list):
        return [_plain(item) for item in value]
    return value


def _write(value: object) -> None:
    sys.stdout.buffer.write(
        (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")
    )


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"solve", "check"}:
        raise ValueError("unsupported_adapter_command")
    payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    problem = _decode(payload.get("problem"), "problem")
    query = _decode(payload.get("query"), "query")
    if sys.argv[1] == "solve":
        try:
            from scipy import __version__ as scipy_version
            from writ_decision_lab.build2.engine import produce
        except ImportError:
            return 69
        if scipy_version != "1.17.0":
            return 69
        _write(produce(problem, query))
        return 0

    try:
        from writ_decision_lab.build2.checker import check
    except ImportError:
        return 69
    candidate = json.loads(_decode(payload.get("candidate_result"), "candidate_result").decode("utf-8"))
    checked = check(candidate, problem, query)
    _write(
        {
            "operation": checked.operation,
            "status": checked.status,
            "family_kind": checked.family_kind,
            "model_sha256": checked.model_sha256,
            "query_sha256": checked.query_sha256,
            "conclusion": _plain(checked.conclusion),
        }
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        sys.stderr.write("Pinned Decision Lab adapter rejected the request.\n")
        raise SystemExit(65)
