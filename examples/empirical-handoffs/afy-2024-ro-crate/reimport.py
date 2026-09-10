"""Fail-closed example-local reimport for an independently authored AFY assessment."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

USE_FIELDS = {"operation", "population", "decision_time", "conclusion", "authority"}
ALLOWED_EMPIRICAL = {"supported", "inconclusive", "not_established", "contested"}
ALLOWED_APPLICABILITY = {"reassessment_required", "not_established", "inapplicable"}
EXTERNAL_DATA_SHA256 = (
    "fbb9136eaaa6b56e66201f57379bd3891f72d80a91cf34c43d76213287abf8a3"
)
EXTERNAL_DATA_BYTES = 2_104_931
BELL_COMMIT = "58987d2389b6fc841a2b780cb45d4369d6a3e436"
PORTABLE_CASE = "payload/bellman-afy-2024/portable-case.json"
FIRST_RESULTS = "payload/bellman-afy-2024/first-results/results.json"


def need(condition: bool, code: str) -> None:
    if not condition:
        raise ValueError(code)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_payload(
    crate: Path,
    expected_payload_manifest_sha256: str,
    expected_metadata_sha256: str,
) -> dict[str, Any]:
    manifest_path = crate / "payload-manifest.json"
    need(
        digest(manifest_path) == expected_payload_manifest_sha256,
        "AFY_HANDOFF_ISSUED_PAYLOAD_MANIFEST_MISMATCH",
    )
    need(
        digest(crate / "ro-crate-metadata.json") == expected_metadata_sha256,
        "AFY_HANDOFF_ISSUED_METADATA_MISMATCH",
    )
    manifest = json.loads(manifest_path.read_text())
    need(
        manifest.get("schema") == "example.afy2024.payload-manifest.v1",
        "AFY_HANDOFF_PAYLOAD_MANIFEST_SCHEMA_MISMATCH",
    )
    need(
        manifest.get("external_data", {}).get("included") is False,
        "AFY_HANDOFF_RAW_DATA_MARKED_INCLUDED",
    )
    actual_files = {
        path.relative_to(crate).as_posix()
        for path in crate.rglob("*")
        if path.is_file()
    }
    allowed_files = set(manifest.get("files", {})) | {
        "payload-manifest.json",
        "ro-crate-metadata.json",
    }
    for relative in sorted(actual_files):
        path = crate / relative
        need(
            not path.is_symlink() and path.resolve().is_relative_to(crate),
            f"AFY_HANDOFF_ATTACHED_SYMLINK_REJECTED:{relative}",
        )
        need(
            not (
                path.stat().st_size == EXTERNAL_DATA_BYTES
                and digest(path) == EXTERNAL_DATA_SHA256
            ),
            f"AFY_HANDOFF_RAW_DATA_REDISTRIBUTED:{relative}",
        )
    undeclared = sorted(actual_files - allowed_files)
    need(
        not undeclared,
        f"AFY_HANDOFF_UNDECLARED_ATTACHED_FILE:{undeclared[0] if undeclared else ''}",
    )
    for relative, expected in manifest.get("files", {}).items():
        path = (crate / relative).resolve()
        need(
            path.is_relative_to(crate) and path.is_file(),
            "AFY_HANDOFF_ATTACHED_FILE_MISSING",
        )
        need(digest(path) == expected, f"AFY_HANDOFF_ATTACHED_FILE_MISMATCH:{relative}")
    return manifest


def pointer(document: Any, value: str) -> Any:
    need(value.startswith("/"), "AFY_HANDOFF_EVIDENCE_POINTER_INVALID")
    current = document
    for token in value[1:].split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        if isinstance(current, list):
            need(
                token.isdigit() and int(token) < len(current),
                "AFY_HANDOFF_EVIDENCE_POINTER_MISSING",
            )
            current = current[int(token)]
        elif isinstance(current, dict):
            need(token in current, "AFY_HANDOFF_EVIDENCE_POINTER_MISSING")
            current = current[token]
        else:
            raise TypeError("AFY_HANDOFF_EVIDENCE_POINTER_MISSING")
    return current


def reimport(
    crate: Path,
    response_path: Path,
    expected_payload_manifest_sha256: str,
    expected_metadata_sha256: str,
) -> dict[str, Any]:
    crate = crate.resolve()
    response_path = response_path.resolve()
    manifest = verify_payload(
        crate, expected_payload_manifest_sha256, expected_metadata_sha256
    )
    original_path = crate / "handoff" / "original-assessment.json"
    task_path = crate / "handoff" / "recipient-task.json"
    original = json.loads(original_path.read_text())
    task = json.loads(task_path.read_text())
    response = json.loads(response_path.read_text())

    original_evidence = original.get("evidence", {})
    need(
        original_evidence.get("bellman_commit") == BELL_COMMIT,
        "AFY_HANDOFF_ORIGINAL_COMMIT_MISMATCH",
    )
    need(
        original_evidence.get("portable_case_sha256") == digest(crate / PORTABLE_CASE),
        "AFY_HANDOFF_ORIGINAL_PORTABLE_CASE_MISMATCH",
    )
    need(
        original_evidence.get("result_sha256") == digest(crate / FIRST_RESULTS),
        "AFY_HANDOFF_ORIGINAL_RESULT_MISMATCH",
    )
    need(
        original_evidence.get("external_data_sha256")
        == manifest["external_data"]["sha256"]
        == EXTERNAL_DATA_SHA256,
        "AFY_HANDOFF_ORIGINAL_EXTERNAL_DATA_MISMATCH",
    )

    need(
        response.get("schema") == "example.afy2024.recipient-assessment.v1",
        "AFY_HANDOFF_RESPONSE_SCHEMA_MISMATCH",
    )
    need(
        isinstance(response.get("assessment_id"), str) and response["assessment_id"],
        "AFY_HANDOFF_RESPONSE_ID_MISSING",
    )
    need(
        response["assessment_id"] != original["assessment_id"],
        "AFY_HANDOFF_ORIGINAL_REWRITTEN",
    )
    need(
        response.get("predecessor")
        == {
            "assessment_id": original["assessment_id"],
            "sha256": digest(original_path),
        },
        "AFY_HANDOFF_PREDECESSOR_MISMATCH",
    )
    need(response.get("question") == task["question"], "AFY_HANDOFF_QUESTION_MISMATCH")
    intended = response.get("intended_use")
    need(
        isinstance(intended, dict) and set(intended) == USE_FIELDS,
        "AFY_HANDOFF_INTENDED_USE_FIELDS_MISMATCH",
    )
    need(
        intended == task["requested_intended_use"], "AFY_HANDOFF_INTENDED_USE_MISMATCH"
    )
    changed = sorted(
        key for key in USE_FIELDS if intended[key] != original["intended_use"][key]
    )
    need(bool(changed), "AFY_HANDOFF_MISTAKEN_SAME_USE")

    challenge = response.get("challenge")
    need(isinstance(challenge, dict), "AFY_HANDOFF_CHALLENGE_MISSING")
    need(
        challenge.get("dependency_kind") == "intended_use",
        "AFY_HANDOFF_CHALLENGE_KIND_UNSUPPORTED",
    )
    allowed_dependency_ids = {f"requested_intended_use.{key}" for key in changed}
    need(
        challenge.get("dependency_id") in allowed_dependency_ids,
        "AFY_HANDOFF_CHALLENGE_DEPENDENCY_MISMATCH",
    )
    need(
        isinstance(challenge.get("summary"), str) and challenge["summary"],
        "AFY_HANDOFF_CHALLENGE_SUMMARY_MISSING",
    )
    evidence_pointers = challenge.get("evidence_pointers")
    need(
        isinstance(evidence_pointers, list) and bool(evidence_pointers),
        "AFY_HANDOFF_CHALLENGE_EVIDENCE_MISSING",
    )
    for evidence in evidence_pointers:
        relative = evidence.get("file", "")
        path = (crate / relative).resolve()
        need(
            path.is_relative_to(crate) and path.is_file() and path.suffix == ".json",
            "AFY_HANDOFF_EVIDENCE_FILE_INVALID",
        )
        pointer(json.loads(path.read_text()), evidence.get("json_pointer", ""))

    numerical = response.get("numerical_receiving", {})
    need(
        numerical.get("status") == "freshly_received",
        "AFY_HANDOFF_NUMERICAL_RECEIVING_NOT_FRESH",
    )
    need(
        numerical.get("evidence_file") == "native-receiving.json",
        "AFY_HANDOFF_NUMERICAL_RECEIVING_EVIDENCE_MISMATCH",
    )
    need(
        isinstance(numerical.get("scope"), str) and numerical["scope"],
        "AFY_HANDOFF_NUMERICAL_RECEIVING_SCOPE_MISSING",
    )
    empirical = response.get("empirical_support", {})
    need(
        empirical.get("status") in ALLOWED_EMPIRICAL,
        "AFY_HANDOFF_EMPIRICAL_STATUS_UNSUPPORTED",
    )
    need(
        isinstance(empirical.get("findings"), list) and bool(empirical["findings"]),
        "AFY_HANDOFF_EMPIRICAL_FINDINGS_MISSING",
    )
    applicability = response.get("applicability", {})
    need(
        applicability.get("status") in ALLOWED_APPLICABILITY,
        "AFY_HANDOFF_CHANGED_USE_NOT_RECONSIDERED",
    )
    need(
        applicability.get("changed_dependencies") == changed,
        "AFY_HANDOFF_CHANGED_DEPENDENCIES_INCOMPLETE",
    )
    disposition = response.get("disposition", {})
    need(disposition.get("authority_to_act") is False, "AFY_HANDOFF_AUTHORITY_INVENTED")
    need(
        isinstance(disposition.get("status"), str) and disposition["status"],
        "AFY_HANDOFF_DISPOSITION_MISSING",
    )
    need(
        isinstance(disposition.get("rationale"), str) and disposition["rationale"],
        "AFY_HANDOFF_DISPOSITION_RATIONALE_MISSING",
    )
    need(
        isinstance(response.get("limits"), list) and response["limits"],
        "AFY_HANDOFF_LIMITS_MISSING",
    )

    return {
        "schema": "example.afy2024.assessment-link.v1",
        "scope": "example-local reimport receipt; not a native Writ record or statistical certificate",
        "issued_payload_manifest_sha256": expected_payload_manifest_sha256,
        "issued_metadata_sha256": expected_metadata_sha256,
        "original": {
            "assessment_id": original["assessment_id"],
            "sha256": digest(original_path),
            "preserved": True,
        },
        "successor": {
            "assessment_id": response["assessment_id"],
            "sha256": digest(response_path),
            "changed_dependencies": changed,
        },
        "numerical_receiving": "freshly_received",
        "empirical_support": response["empirical_support"]["status"],
        "applicability": response["applicability"]["status"],
        "disposition": response["disposition"]["status"],
        "authority_to_act": False,
        "interpretation_status": "supplied_recipient_assessment_not_verified_as_truth",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crate", type=Path, required=True)
    parser.add_argument("--response", type=Path, required=True)
    parser.add_argument("--payload-manifest-sha256", required=True)
    parser.add_argument("--metadata-sha256", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = reimport(
        args.crate,
        args.response,
        args.payload_manifest_sha256,
        args.metadata_sha256,
    )
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
