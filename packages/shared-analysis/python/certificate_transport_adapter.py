"""Fixed subprocess bridge to the pinned Decision Lab certificate-transport adapter."""

from __future__ import annotations

import base64
import json
import platform
import sys
from pathlib import Path


def _decode(value: object, field: str) -> bytes:
    if not isinstance(value, str):
        raise TypeError(f"{field}_must_be_base64")
    return base64.b64decode(value, validate=True)


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
    sys.path.insert(0, str(source_root))
    payload = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    request = _decode(payload.get("request"), "request")

    if sys.argv[1] == "solve":
        try:
            from writ_decision_lab.transport.producer import produce_bytes
        except ImportError:
            return _unavailable("pinned_transport_producer_unavailable")
        _verify_repository_module_origins(source_root)
        sys.stdout.buffer.write(produce_bytes(request))
        return 0

    try:
        from writ_decision_lab.transport.checker import check_bytes
    except ImportError:
        return _unavailable("pinned_transport_checker_unavailable")
    _verify_repository_module_origins(source_root)
    evidence = _decode(payload.get("evidence"), "evidence")
    sys.stdout.buffer.write(check_bytes(request, evidence))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:  # noqa: BLE001 - collapse untrusted adapter failures at the protocol boundary
        sys.stderr.write("Pinned Decision Lab certificate-transport adapter rejected the request.\n")
        raise SystemExit(65)
