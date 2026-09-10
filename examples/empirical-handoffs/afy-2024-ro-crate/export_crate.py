"""Export the frozen Bellman AFY case as an attached Process Run RO-Crate.

The author data remains external. This exporter verifies it for the fresh Bellman
receiver but never copies it into the crate.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

BASE_PROFILE = "https://w3id.org/ro/crate/1.1"
PROCESS_PROFILE = "https://w3id.org/ro/wfrun/process/0.5"
EXTERNAL_DATA_URL = "https://gfrechette.com/data/Aoyagi_2024a_data.txt"
EXTERNAL_DATA_SHA256 = (
    "fbb9136eaaa6b56e66201f57379bd3891f72d80a91cf34c43d76213287abf8a3"
)
EXTERNAL_DATA_BYTES = 2_104_931
BELL_COMMIT = "58987d2389b6fc841a2b780cb45d4369d6a3e436"
BELL_BASE = "https://github.com/saykig/bellman/blob/58987d2389b6fc841a2b780cb45d4369d6a3e436/research/beliefs_2024"
RECEIVER_TOOL = "payload/bellman-afy-2024/checks.py"
TRANSFER_TOOL = "payload/bellman-afy-2024/check_transfer.py"
RECEIVER_URL = f"{BELL_BASE}/checks.py"
TRANSFER_URL = f"{BELL_BASE}/check_transfer.py"
FIRST_RUN_MANIFEST_SHA256 = (
    "4acfdb28c6accb66f0c9553835b797147c8c18422b2143e08b22a79c71c05cc9"
)
BELL_LICENSE_SHA256 = "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4"

EXTRA_ARTIFACT_HASHES = {
    "README.md": "e7279d2974d6db5515fd31d7b78d95a2ee6340156d1ffe610c4275309746ba15",
    "COMPLETION_AUDIT.md": "c2438ace6df2e71371fb74379c0f8523892f3f1bd5dba9172e679c3cb18f331f",
    "IDENTIFICATION_AUDIT.md": "c5f9e8f6caab2c4bccab9a43e8fd2a6db55a35244b3f57ba3bba753f4fc99c57",
    "PRIOR_AND_UTILITY_REVIEW_20260909.md": "bb24e0cd4d1b8eefb3a5b97460284090d7151f9aa635a2d66dfb4510a3008535",
    "TRANSFER.md": "3e15fff28cb13abb931157633519340a72ba5beff4cf65c21c62b09806196206",
    "portable-case.json": "606b461664025c4d5e08211121129eef3e61a0f89efb059c0cc7cde4e2deb43b",
    "receiver.py": "641462442749e921635123d14543a88796f31332de2e5a57edf1164da31e70b1",
    "checks.py": "c75cc947f0f9a896b7f683bc10ff78862f50cf1b0938abb9f77d479f96408eb6",
    "check_transfer.py": "5ff8aeda40fb1f10a5c384171b348c8107313c4aab6f335cf24affb77980daa6",
    "receiving-checkpoint.json": "dc7c5d2363dc0411bb4b2f9647c167c59552f8791b1987c0321c98df266f8bba",
    "reproduction-checkpoint.json": "955285bb3b1a33816a14b2ef37bb91ac20788b7b21843c3db87b926acbb73bcb",
    "prior-sensitivity-results.json": "f3c27e314855e916d8e6fbb1096e878c1e4283ce942d8fc54299acf5cbdc2e80",
    "sensitivity-checkpoint.json": "dcf20b2a5d2619328340380a17ad58d3b16e7a0263ff3429f12aa170d0ef086c",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def run_json(command: list[str], *, cwd: Path) -> dict[str, Any]:
    completed = subprocess.run(
        command,
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1"},
    )
    value = json.loads(completed.stdout)
    if not isinstance(value, dict):
        raise TypeError("AFY_HANDOFF_PROCESS_OUTPUT_NOT_OBJECT")
    return value


def selected_artifacts(source: Path) -> tuple[dict[str, str], set[str]]:
    first_manifest_path = source / "first-run-manifest.json"
    if (
        not first_manifest_path.is_file()
        or digest(first_manifest_path) != FIRST_RUN_MANIFEST_SHA256
    ):
        raise ValueError("AFY_HANDOFF_FIRST_RUN_MANIFEST_MISMATCH")
    first_manifest = json.loads(first_manifest_path.read_text())
    asserted = {**first_manifest["source_hashes"], **first_manifest["outputs"]}
    selected = set(asserted) | set(EXTRA_ARTIFACT_HASHES) | {"first-run-manifest.json"}
    for relative, expected in asserted.items():
        path = source / relative
        if not path.is_file():
            raise ValueError(f"AFY_HANDOFF_MISSING_SOURCE_ARTIFACT:{relative}")
        if digest(path) != expected:
            raise ValueError(f"AFY_HANDOFF_FROZEN_SOURCE_MISMATCH:{relative}")
    for relative, expected in EXTRA_ARTIFACT_HASHES.items():
        path = source / relative
        if not path.is_file():
            raise ValueError(f"AFY_HANDOFF_MISSING_SOURCE_ARTIFACT:{relative}")
        if digest(path) != expected:
            raise ValueError(f"AFY_HANDOFF_PINNED_EXTRA_MISMATCH:{relative}")
    return asserted, selected


def file_entity(crate_path: Path, relative: str) -> dict[str, Any]:
    path = crate_path / relative
    media_type = mimetypes.guess_type(relative)[0] or "application/octet-stream"
    return {
        "@id": relative,
        "@type": ["File", "MediaObject"],
        "name": Path(relative).name,
        "encodingFormat": media_type,
        "contentSize": str(path.stat().st_size),
        "sha256": digest(path),
    }


def export(
    source: Path, raw_data: Path, output: Path, support_dir: Path
) -> dict[str, Any]:
    source = source.resolve()
    raw_data = raw_data.resolve()
    output = output.resolve()
    if output.exists():
        raise ValueError("AFY_HANDOFF_OUTPUT_ALREADY_EXISTS")
    if (
        not raw_data.is_file()
        or digest(raw_data) != EXTERNAL_DATA_SHA256
        or raw_data.stat().st_size != EXTERNAL_DATA_BYTES
    ):
        raise ValueError("AFY_HANDOFF_EXTERNAL_DATA_IDENTITY_MISMATCH")

    _, selected = selected_artifacts(source)
    payload = output / "payload" / "bellman-afy-2024"
    payload.mkdir(parents=True)
    for relative in sorted(selected):
        origin = source / relative
        target = payload / relative
        if not origin.is_file():
            raise ValueError(f"AFY_HANDOFF_MISSING_SOURCE_ARTIFACT:{relative}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(origin, target)

    handoff = output / "handoff"
    handoff.mkdir()
    bell_license = source.parents[1] / "LICENSE"
    if not bell_license.is_file() or digest(bell_license) != BELL_LICENSE_SHA256:
        raise ValueError("AFY_HANDOFF_BELLMAN_LICENSE_MISMATCH")
    shutil.copyfile(bell_license, payload / "LICENSE")
    for name in (
        "recipient-task.json",
        "original-assessment.json",
        "RECIPIENT_RESPONSE.md",
    ):
        shutil.copyfile(support_dir / name, handoff / name)

    receiving = run_json([sys.executable, "checks.py", str(raw_data)], cwd=payload)
    transfer = run_json(
        [sys.executable, "check_transfer.py", str(raw_data)], cwd=payload
    )
    run_end = datetime.now(timezone.utc).isoformat(timespec="seconds")
    write_json(output / "native-receiving.json", receiving)
    write_json(output / "transfer-check.json", transfer)

    attached = [
        path.relative_to(output).as_posix()
        for path in output.rglob("*")
        if path.is_file()
        and path.name not in {"ro-crate-metadata.json", "payload-manifest.json"}
    ]
    manifest = {
        "schema": "example.afy2024.payload-manifest.v1",
        "bellman_commit": BELL_COMMIT,
        "external_data": {
            "url": EXTERNAL_DATA_URL,
            "sha256": EXTERNAL_DATA_SHA256,
            "bytes": EXTERNAL_DATA_BYTES,
            "included": False,
        },
        "files": {relative: digest(output / relative) for relative in sorted(attached)},
    }
    write_json(output / "payload-manifest.json", manifest)
    attached.append("payload-manifest.json")

    file_entities = [file_entity(output, relative) for relative in sorted(attached)]
    root_parts = [{"@id": item["@id"]} for item in file_entities]
    # RO-Crate 1.1 requires every data entity, including a Web-based Data
    # Entity that is deliberately not attached, to be reachable via hasPart.
    root_parts.append({"@id": EXTERNAL_DATA_URL})
    metadata: dict[str, Any] = {
        "@context": [
            "https://w3id.org/ro/crate/1.1/context",
            "https://w3id.org/ro/terms/workflow-run/context",
        ],
        "@graph": [
            {
                "@id": "ro-crate-metadata.json",
                "@type": "CreativeWork",
                "about": {"@id": "./"},
                "conformsTo": {"@id": BASE_PROFILE},
            },
            {
                "@id": "./",
                "@type": "Dataset",
                "name": "AFY 2024 retrospective predictor challenge handoff",
                "description": "Frozen Bellman evidence, fresh receiving results, and a bounded continuation task. The author data is hash-bound but not redistributed.",
                "datePublished": "2026-09-10",
                "license": {"@id": "https://www.apache.org/licenses/LICENSE-2.0"},
                "usageInfo": "Apache-2.0 covers the crate metadata and attached Bellman/Writ materials only. It does not license the external raw-data Web entity, whose redistribution licence is not established.",
                "conformsTo": {"@id": PROCESS_PROFILE},
                "hasPart": root_parts,
                "mentions": [
                    {"@id": "#fresh-native-receiving"},
                    {"@id": "#fresh-transfer-check"},
                    {"@id": EXTERNAL_DATA_URL},
                ],
            },
            {
                "@id": BASE_PROFILE,
                "@type": "CreativeWork",
                "name": "RO-Crate Metadata Specification 1.1",
                "version": "1.1",
            },
            {
                "@id": PROCESS_PROFILE,
                "@type": "CreativeWork",
                "name": "Process Run Crate profile",
                "version": "0.5",
            },
            {
                "@id": EXTERNAL_DATA_URL,
                "@type": ["File", "MediaObject"],
                "name": "Aoyagi_2024a_data.txt",
                "description": "Author-hosted data required for fresh receiving; deliberately not included in this crate.",
                "conditionsOfAccess": "Public author URL; redistribution licence for these exact bytes is not established.",
                "contentSize": str(EXTERNAL_DATA_BYTES),
                "encodingFormat": "text/tab-separated-values",
                "sdDatePublished": "2026-09-09",
                "sha256": EXTERNAL_DATA_SHA256,
            },
            {
                "@id": RECEIVER_TOOL,
                "@type": "SoftwareApplication",
                "name": "Bellman AFY independent receiver checks",
                "url": RECEIVER_URL,
                "softwareVersion": "58987d2389b6fc841a2b780cb45d4369d6a3e436",
                "programmingLanguage": "Python 3 standard library",
            },
            {
                "@id": TRANSFER_TOOL,
                "@type": "SoftwareApplication",
                "name": "Bellman AFY intended-use transfer check",
                "url": TRANSFER_URL,
                "softwareVersion": "58987d2389b6fc841a2b780cb45d4369d6a3e436",
                "programmingLanguage": "Python 3 standard library",
            },
            {
                "@id": "#fresh-native-receiving",
                "@type": "CreateAction",
                "name": "Fresh producer-disabled AFY receiving",
                "description": "PYTHONDONTWRITEBYTECODE=1 python checks.py /external/Aoyagi_2024a_data.txt",
                "endTime": run_end,
                "instrument": {"@id": RECEIVER_TOOL},
                "object": [
                    {"@id": EXTERNAL_DATA_URL},
                    {"@id": "payload/bellman-afy-2024/first-run-manifest.json"},
                ],
                "result": {"@id": "native-receiving.json"},
            },
            {
                "@id": "#fresh-transfer-check",
                "@type": "CreateAction",
                "name": "Fresh AFY intended-use transfer check",
                "description": "PYTHONDONTWRITEBYTECODE=1 python check_transfer.py /external/Aoyagi_2024a_data.txt",
                "endTime": run_end,
                "instrument": {"@id": TRANSFER_TOOL},
                "object": [
                    {"@id": EXTERNAL_DATA_URL},
                    {"@id": "payload/bellman-afy-2024/portable-case.json"},
                ],
                "result": {"@id": "transfer-check.json"},
            },
            {
                "@id": "https://www.apache.org/licenses/LICENSE-2.0",
                "@type": "CreativeWork",
                "name": "Apache License 2.0",
            },
            *file_entities,
        ],
    }
    # Merge duplicate file/software entities into a single JSON-LD entity per @id.
    merged: dict[str, dict[str, Any]] = {}
    for entity in metadata["@graph"]:
        identifier = entity["@id"]
        if identifier in merged:
            previous = merged[identifier]
            types = previous.get("@type", [])
            types = [types] if isinstance(types, str) else types
            incoming = entity.get("@type", [])
            incoming = [incoming] if isinstance(incoming, str) else incoming
            previous.update(entity)
            previous["@type"] = list(dict.fromkeys(types + incoming))
        else:
            merged[identifier] = entity
    metadata["@graph"] = list(merged.values())
    write_json(output / "ro-crate-metadata.json", metadata)
    return {
        "crate": str(output),
        "files": len(attached),
        "payload_manifest_sha256": digest(output / "payload-manifest.json"),
        "metadata_sha256": digest(output / "ro-crate-metadata.json"),
        "external_data_included": False,
        "external_data_sha256": EXTERNAL_DATA_SHA256,
        "base_profile": BASE_PROFILE,
        "process_profile": PROCESS_PROFILE,
        "receiving_schema": receiving.get("positive", {}).get("schema"),
        "producer_disabled": receiving.get("producer_disabled"),
        "changed_use_status": transfer["changed_mechanism_use"]["applicability"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bellman-dir", type=Path, required=True)
    parser.add_argument("--raw-data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            export(
                args.bellman_dir,
                args.raw_data,
                args.output,
                Path(__file__).resolve().parent,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
