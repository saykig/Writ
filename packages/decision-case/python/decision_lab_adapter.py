"""Fixed subprocess bridge to the pinned Writ Decision Lab Build 2 interface."""

from __future__ import annotations

import base64
import json
import platform
import sys
from collections.abc import Mapping
from pathlib import Path


def _decode(value: object, field: str) -> bytes:
    if not isinstance(value, str):
        raise TypeError(f"{field}_must_be_base64")
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


def _unavailable(reason: str) -> int:
    sys.stderr.write(reason + "\n")
    return 69


def _verify_repository_module_origins(source_root: Path) -> None:
    for name, module in sys.modules.items():
        if name != "writ_decision_lab" and not name.startswith("writ_decision_lab."):
            continue
        origin = getattr(module, "__file__", None)
        if not isinstance(origin, str):
            raise RuntimeError("repository_module_origin_unavailable")
        resolved = Path(origin).resolve(strict=True)
        if resolved.suffix != ".py" or not resolved.is_relative_to(source_root):
            raise RuntimeError("repository_module_origin_outside_verified_source")


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in {"solve", "check"}:
        raise ValueError("unsupported_adapter_command")
    if platform.python_implementation() != "CPython" or sys.version_info[:2] != (3, 13):
        return _unavailable(
            f"unsupported_python_runtime:{platform.python_implementation()}:{sys.version_info.major}.{sys.version_info.minor}"
        )
    source_root = Path(sys.argv[2]).resolve(strict=True)
    if not source_root.is_dir():
        return _unavailable("pinned_source_root_unavailable")
    # The caller constructs this private source-only tree from the exact bytes it hashed. Isolated
    # mode ignores ambient import paths; repository module origins are checked after import.
    sys.path.insert(0, str(source_root))
    payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    problem = _decode(payload.get("problem"), "problem")
    query = _decode(payload.get("query"), "query")
    if sys.argv[1] == "solve":
        try:
            from scipy import __version__ as scipy_version
            from writ_decision_lab.build2.engine import produce
        except ImportError:
            return _unavailable("pinned_solver_import_unavailable")
        if scipy_version != "1.17.0":
            return _unavailable(f"unsupported_scipy_runtime:{scipy_version}")
        _verify_repository_module_origins(source_root)
        _write(produce(problem, query))
        return 0

    try:
        from writ_decision_lab.build2.checker import check
    except ImportError:
        return _unavailable("pinned_checker_import_unavailable")
    _verify_repository_module_origins(source_root)
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
    except Exception:  # noqa: BLE001 - collapse untrusted adapter failures at the protocol boundary
        sys.stderr.write("Pinned Decision Lab adapter rejected the request.\n")
        raise SystemExit(65)
