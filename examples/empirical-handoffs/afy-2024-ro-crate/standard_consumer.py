"""Open the AFY crate with ro-crate-py and report its bounded exchange surface."""

from __future__ import annotations

import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
from typing import Any

from rocrate.rocrate import ROCrate  # type: ignore[import-not-found]

BASE_PROFILE = "https://w3id.org/ro/crate/1.1"
PROCESS_PROFILE = "https://w3id.org/ro/wfrun/process/0.5"
EXTERNAL_DATA_URL = "https://gfrechette.com/data/Aoyagi_2024a_data.txt"
EXTERNAL_DATA_SHA256 = (
    "fbb9136eaaa6b56e66201f57379bd3891f72d80a91cf34c43d76213287abf8a3"
)
EXTERNAL_DATA_BYTES = 2_104_931
BELL_COMMIT = "58987d2389b6fc841a2b780cb45d4369d6a3e436"
PORTABLE_CASE = "payload/bellman-afy-2024/portable-case.json"
FIRST_RESULTS = "payload/bellman-afy-2024/first-results/results.json"
RECEIVER_TOOL = "payload/bellman-afy-2024/checks.py"
TRANSFER_TOOL = "payload/bellman-afy-2024/check_transfer.py"
LICENSE_SCOPE = (
    "Apache-2.0 covers the crate metadata and attached Bellman/Writ materials only. "
    "It does not license the external raw-data Web entity, whose redistribution licence "
    "is not established."
)


def need(condition: bool, code: str) -> None:
    if not condition:
        raise ValueError(code)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entity_dict(crate: ROCrate, identifier: str) -> dict[str, Any]:
    entity = crate.get(identifier)
    need(entity is not None, f"AFY_HANDOFF_CRATE_ENTITY_MISSING:{identifier}")
    value = entity.as_jsonld()
    need(isinstance(value, dict), f"AFY_HANDOFF_CRATE_ENTITY_INVALID:{identifier}")
    return value


def consume(
    crate_path: Path,
    expected_payload_manifest_sha256: str,
    expected_metadata_sha256: str,
) -> dict[str, Any]:
    crate_path = crate_path.resolve()
    manifest_path = crate_path / "payload-manifest.json"
    need(
        digest(manifest_path) == expected_payload_manifest_sha256,
        "AFY_HANDOFF_ISSUED_PAYLOAD_MANIFEST_MISMATCH",
    )
    need(
        digest(crate_path / "ro-crate-metadata.json") == expected_metadata_sha256,
        "AFY_HANDOFF_ISSUED_METADATA_MISMATCH",
    )
    manifest = json.loads(manifest_path.read_text())
    actual_files = {
        path.relative_to(crate_path).as_posix()
        for path in crate_path.rglob("*")
        if path.is_file()
    }
    allowed_files = set(manifest["files"]) | {
        "payload-manifest.json",
        "ro-crate-metadata.json",
    }
    for relative in sorted(actual_files):
        path = crate_path / relative
        need(
            not path.is_symlink() and path.resolve().is_relative_to(crate_path),
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

    crate = ROCrate(crate_path)
    root = entity_dict(crate, "./")
    descriptor = entity_dict(crate, "ro-crate-metadata.json")
    process_profile = entity_dict(crate, PROCESS_PROFILE)
    external_data = entity_dict(crate, EXTERNAL_DATA_URL)
    receiving_action = entity_dict(crate, "#fresh-native-receiving")
    transfer_action = entity_dict(crate, "#fresh-transfer-check")

    need(
        descriptor.get("conformsTo", {}).get("@id") == BASE_PROFILE,
        "AFY_HANDOFF_BASE_PROFILE_MISMATCH",
    )
    need(
        descriptor.get("about", {}).get("@id") == "./",
        "AFY_HANDOFF_DESCRIPTOR_ABOUT_MISMATCH",
    )
    need(
        root.get("conformsTo", {}).get("@id") == PROCESS_PROFILE,
        "AFY_HANDOFF_PROCESS_PROFILE_MISMATCH",
    )
    need(root.get("usageInfo") == LICENSE_SCOPE, "AFY_HANDOFF_LICENSE_SCOPE_MISSING")
    need(
        process_profile.get("version") == "0.5",
        "AFY_HANDOFF_PROCESS_PROFILE_VERSION_MISMATCH",
    )
    for action, instrument, objects, result in (
        (
            receiving_action,
            RECEIVER_TOOL,
            [
                EXTERNAL_DATA_URL,
                "payload/bellman-afy-2024/first-run-manifest.json",
            ],
            "native-receiving.json",
        ),
        (
            transfer_action,
            TRANSFER_TOOL,
            [EXTERNAL_DATA_URL, PORTABLE_CASE],
            "transfer-check.json",
        ),
    ):
        need(
            action.get("@type") == "CreateAction",
            "AFY_HANDOFF_PROCESS_ACTION_TYPE_MISMATCH",
        )
        need(
            action.get("instrument", {}).get("@id") == instrument,
            "AFY_HANDOFF_PROCESS_INSTRUMENT_MISMATCH",
        )
        need(
            [item.get("@id") for item in action.get("object", [])] == objects,
            "AFY_HANDOFF_PROCESS_OBJECT_MISMATCH",
        )
        need(
            action.get("result", {}).get("@id") == result,
            "AFY_HANDOFF_PROCESS_RESULT_MISMATCH",
        )
    need(
        external_data.get("sha256") == EXTERNAL_DATA_SHA256,
        "AFY_HANDOFF_EXTERNAL_REFERENCE_MISMATCH",
    )
    need(
        "redistribution licence for these exact bytes is not established"
        in external_data.get("conditionsOfAccess", ""),
        "AFY_HANDOFF_EXTERNAL_LICENSE_SCOPE_MISSING",
    )

    need(
        manifest["external_data"]["included"] is False,
        "AFY_HANDOFF_RAW_DATA_MARKED_INCLUDED",
    )
    for relative, expected in manifest["files"].items():
        path = crate_path / relative
        need(path.is_file(), f"AFY_HANDOFF_ATTACHED_FILE_MISSING:{relative}")
        need(digest(path) == expected, f"AFY_HANDOFF_ATTACHED_FILE_MISMATCH:{relative}")
        item = entity_dict(crate, relative)
        need(
            item.get("sha256") == expected,
            f"AFY_HANDOFF_METADATA_HASH_MISMATCH:{relative}",
        )

    original = json.loads((crate_path / "handoff/original-assessment.json").read_text())
    evidence = original.get("evidence", {})
    need(
        evidence.get("bellman_commit") == BELL_COMMIT,
        "AFY_HANDOFF_ORIGINAL_COMMIT_MISMATCH",
    )
    need(
        evidence.get("portable_case_sha256") == digest(crate_path / PORTABLE_CASE),
        "AFY_HANDOFF_ORIGINAL_PORTABLE_CASE_MISMATCH",
    )
    need(
        evidence.get("result_sha256") == digest(crate_path / FIRST_RESULTS),
        "AFY_HANDOFF_ORIGINAL_RESULT_MISMATCH",
    )
    need(
        evidence.get("external_data_sha256")
        == manifest["external_data"]["sha256"]
        == EXTERNAL_DATA_SHA256,
        "AFY_HANDOFF_ORIGINAL_EXTERNAL_DATA_MISMATCH",
    )

    receiving = json.loads((crate_path / "native-receiving.json").read_text())
    transfer = json.loads((crate_path / "transfer-check.json").read_text())
    need(
        receiving.get("producer_disabled") is True, "AFY_HANDOFF_PRODUCER_NOT_DISABLED"
    )
    need(
        receiving.get("positive", {}).get("schema") == "bellman.afy2024.receiving.v1",
        "AFY_HANDOFF_RECEIVING_SCHEMA_MISMATCH",
    )
    need(
        transfer["changed_mechanism_use"]["applicability"] == "reassessment_required",
        "AFY_HANDOFF_CHANGED_USE_NOT_RECONSIDERED",
    )
    return {
        "schema": "example.afy2024.standard-consumer-report.v1",
        "consumer": {
            "distribution": "rocrate",
            "version": version("rocrate"),
            "role": "third-party RO-Crate reader; not the Bellman numerical receiver",
        },
        "crate": {
            "base_profile": BASE_PROFILE,
            "process_profile": PROCESS_PROFILE,
            "attached_files_checked": len(manifest["files"]),
            "issued_payload_manifest_sha256": expected_payload_manifest_sha256,
            "issued_metadata_sha256": expected_metadata_sha256,
            "external_data_included": False,
            "external_data_sha256": EXTERNAL_DATA_SHA256,
        },
        "profile_check": {
            "status": "targeted_requirements_passed",
            "checked": [
                "metadata descriptor and root profile declarations",
                "unique standard-consumer entity lookup",
                "Process Run software/action/instrument/object/result links",
                "attached file presence and SHA-256",
                "external data non-inclusion and exact reference",
            ],
            "scope": "targeted RO-Crate 1.1 and Process Run Crate 0.5 requirements; not a claim that ro-crate-py is a full profile validator",
        },
        "numerical_receiving": {
            "status": "fresh_receipt_present",
            "schema": receiving["positive"]["schema"],
            "producer_disabled": True,
            "scope": receiving["positive"]["scope"],
        },
        "applicability": {
            "changed_mechanism_use": transfer["changed_mechanism_use"]["applicability"],
            "changed_report_timing": transfer["changed_report_timing"]["applicability"],
        },
        "nonclaims": [
            "Opening metadata does not establish empirical truth.",
            "Fresh numerical receiving does not establish sampling coverage or applicability.",
            "The crate supplies no authority to act.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("crate", type=Path)
    parser.add_argument("--payload-manifest-sha256", required=True)
    parser.add_argument("--metadata-sha256", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = consume(args.crate, args.payload_manifest_sha256, args.metadata_sha256)
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered)
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
