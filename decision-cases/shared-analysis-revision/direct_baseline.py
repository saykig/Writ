"""Competent direct-files baseline for the shared-analysis comparison.

The script deliberately owns no portable revision protocol. It shows the operator work needed to
compare exact separately authored files and run the same pinned Decision Lab producer/checker.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
from typing import Any

from writ_decision_lab.build2.checker import check
from writ_decision_lab.build2.engine import produce


def read_case(path: Path) -> dict[str, Any]:
    return json.loads(path.read_bytes().decode("utf-8"))


def analysis(case: dict[str, Any]) -> dict[str, Any]:
    return next(
        item for item in case["analyses"] if item["analysis_id"] == "analysis-base"
    )


def verified_bytes(value: dict[str, str]) -> bytes:
    raw = base64.b64decode(value["content"], validate=True)
    actual = "sha256:" + hashlib.sha256(raw).hexdigest()
    if actual != value["sha256"]:
        raise ValueError(
            f"byte hash mismatch: expected {value['sha256']}, observed {actual}"
        )
    return raw


def source_identities(case: dict[str, Any]) -> set[tuple[str, str, str]]:
    return {
        (item["source_id"], item["document_version_id"], item["sha256"])
        for item in case["source_documents"]
    }


def assumption_ids(case: dict[str, Any]) -> list[str]:
    return sorted(
        dependency["dependency_id"]
        for dependency in analysis(case)["dependencies"]
        if dependency["kind"] == "modelling_choice"
        and dependency["dependency_id"] != "choice.exact-family"
    )


def execute(case: dict[str, Any]) -> dict[str, Any]:
    selected = analysis(case)
    problem = verified_bytes(selected["mathematical_subject"]["problem"])
    query = verified_bytes(selected["mathematical_subject"]["query"])
    candidate = produce(problem, query)
    checked = check(candidate, problem, query)
    return {
        "status": checked.status,
        "family_kind": checked.family_kind,
        "problem_sha256": selected["mathematical_subject"]["problem"]["sha256"],
        "query_sha256": selected["mathematical_subject"]["query"]["sha256"],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--alpha", required=True, type=Path)
    parser.add_argument("--beta", required=True, type=Path)
    parser.add_argument("--alpha-next", type=Path)
    parser.add_argument("--beta-next", type=Path)
    args = parser.parse_args()

    alpha = read_case(args.alpha)
    beta = read_case(args.beta)
    shared = sorted(source_identities(alpha) & source_identities(beta))
    result: dict[str, Any] = {
        "shared_exact_sources": shared,
        "assumptions": {"alpha": assumption_ids(alpha), "beta": assumption_ids(beta)},
        "base": {"alpha": execute(alpha), "beta": execute(beta)},
    }

    for name, prior, path in [
        ("alpha", alpha, args.alpha_next),
        ("beta", beta, args.beta_next),
    ]:
        if path is None:
            continue
        successor = read_case(path)
        prior_result = result["base"][name]
        next_result = execute(successor)
        result.setdefault("successors", {})[name] = {
            **next_result,
            "mathematical_check_reusable": (
                prior_result["problem_sha256"] == next_result["problem_sha256"]
                and prior_result["query_sha256"] == next_result["query_sha256"]
            ),
            "applicability_requires_reassessment": source_identities(prior)
            != source_identities(successor),
        }

    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
