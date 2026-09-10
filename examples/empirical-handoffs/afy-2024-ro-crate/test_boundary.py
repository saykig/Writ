"""Boundary tests; fixture responses are controls, not retained recipient findings."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from export_crate import export
from reimport import reimport


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class BoundaryTests(unittest.TestCase):
    bellman_dir: Path
    raw_data: Path
    temporary: tempfile.TemporaryDirectory[str]
    root: Path
    crate: Path
    payload_manifest_sha256: str
    metadata_sha256: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory(prefix="writ-afy-boundary-")
        cls.root = Path(cls.temporary.name)
        cls.crate = cls.root / "crate"
        export(
            cls.bellman_dir, cls.raw_data, cls.crate, Path(__file__).resolve().parent
        )
        cls.payload_manifest_sha256 = digest(cls.crate / "payload-manifest.json")
        cls.metadata_sha256 = digest(cls.crate / "ro-crate-metadata.json")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def response(self, crate: Path | None = None) -> dict[str, object]:
        crate = crate or self.crate
        original_path = crate / "handoff" / "original-assessment.json"
        original = json.loads(original_path.read_text())
        task = json.loads((crate / "handoff" / "recipient-task.json").read_text())
        changed = sorted(
            key
            for key in original["intended_use"]
            if original["intended_use"][key] != task["requested_intended_use"][key]
        )
        return {
            "schema": "example.afy2024.recipient-assessment.v1",
            "assessment_id": "boundary-control.successor",
            "predecessor": {
                "assessment_id": original["assessment_id"],
                "sha256": digest(original_path),
            },
            "question": task["question"],
            "intended_use": task["requested_intended_use"],
            "challenge": {
                "dependency_kind": "intended_use",
                "dependency_id": "requested_intended_use.population",
                "summary": "Boundary-control text only; no retained empirical finding.",
                "evidence_pointers": [
                    {
                        "file": "payload/bellman-afy-2024/first-results/results.json",
                        "json_pointer": "/comparisons/ten-linear/comparison/bootstrap_95",
                    }
                ],
            },
            "numerical_receiving": {
                "status": "freshly_received",
                "evidence_file": "native-receiving.json",
                "scope": "boundary-control declaration",
            },
            "empirical_support": {
                "status": "inconclusive",
                "findings": [
                    "Boundary-control declaration, not a retained recipient finding."
                ],
            },
            "applicability": {
                "status": "reassessment_required",
                "changed_dependencies": changed,
            },
            "disposition": {
                "status": "boundary_control_only",
                "rationale": "Exercises validation without supplying the real recipient judgment.",
                "authority_to_act": False,
            },
            "limits": [
                "This response exists only inside the test temporary directory."
            ],
        }

    def write_response(
        self, value: dict[str, object], name: str = "response.json"
    ) -> Path:
        path = self.root / name
        path.write_text(json.dumps(value, indent=2) + "\n")
        return path

    def test_export_preserves_external_data_boundary_and_fresh_checks(self) -> None:
        manifest = json.loads((self.crate / "payload-manifest.json").read_text())
        receiving = json.loads((self.crate / "native-receiving.json").read_text())
        transfer = json.loads((self.crate / "transfer-check.json").read_text())
        self.assertFalse(manifest["external_data"]["included"])
        self.assertFalse((self.crate / "Aoyagi_2024a_data.txt").exists())
        self.assertEqual(
            receiving["positive"]["schema"], "bellman.afy2024.receiving.v1"
        )
        self.assertTrue(receiving["producer_disabled"])
        self.assertEqual(
            transfer["changed_mechanism_use"]["applicability"], "reassessment_required"
        )
        self.assertEqual(transfer["changed_evidence_identity"], "rejected")

    def test_valid_example_local_link_preserves_original(self) -> None:
        response = self.write_response(self.response())
        result = reimport(
            self.crate,
            response,
            self.payload_manifest_sha256,
            self.metadata_sha256,
        )
        self.assertTrue(result["original"]["preserved"])
        self.assertEqual(result["applicability"], "reassessment_required")
        self.assertFalse(result["authority_to_act"])

    def test_reimport_refuses_semantic_boundary_failures(self) -> None:
        controls = []
        stale = self.response()
        stale["applicability"]["status"] = "same_declared_use"  # type: ignore[index]
        controls.append(("stale", stale, "AFY_HANDOFF_CHANGED_USE_NOT_RECONSIDERED"))
        incomplete = self.response()
        incomplete["applicability"]["changed_dependencies"] = ["population"]  # type: ignore[index]
        controls.append(
            ("incomplete", incomplete, "AFY_HANDOFF_CHANGED_DEPENDENCIES_INCOMPLETE")
        )
        authority = self.response()
        authority["disposition"]["authority_to_act"] = True  # type: ignore[index]
        controls.append(("authority", authority, "AFY_HANDOFF_AUTHORITY_INVENTED"))
        rewritten = self.response()
        rewritten["assessment_id"] = "afy-2024-retrospective-comparison.original"
        controls.append(("rewrite", rewritten, "AFY_HANDOFF_ORIGINAL_REWRITTEN"))
        wrong_dependency = self.response()
        wrong_dependency["challenge"]["dependency_id"] = (  # type: ignore[index]
            "requested_intended_use.unrelated"
        )
        controls.append(
            (
                "wrong-dependency",
                wrong_dependency,
                "AFY_HANDOFF_CHALLENGE_DEPENDENCY_MISMATCH",
            )
        )
        for name, value, code in controls:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, code):
                reimport(
                    self.crate,
                    self.write_response(value, f"{name}.json"),
                    self.payload_manifest_sha256,
                    self.metadata_sha256,
                )

    def test_reimport_refuses_altered_attached_evidence(self) -> None:
        changed = self.root / "changed-crate"
        shutil.copytree(self.crate, changed)
        target = (
            changed / "payload" / "bellman-afy-2024" / "first-results" / "results.json"
        )
        target.write_bytes(target.read_bytes() + b"\n")
        response = self.write_response(
            self.response(changed), "changed-evidence-response.json"
        )
        with self.assertRaisesRegex(ValueError, "AFY_HANDOFF_ATTACHED_FILE_MISMATCH"):
            reimport(
                changed,
                response,
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )

    def test_export_refuses_altered_pinned_extra_or_license(self) -> None:
        for name, relative, code in (
            (
                "extra",
                "research/beliefs_2024/README.md",
                "AFY_HANDOFF_PINNED_EXTRA_MISMATCH",
            ),
            ("license", "LICENSE", "AFY_HANDOFF_BELLMAN_LICENSE_MISMATCH"),
        ):
            with self.subTest(name=name):
                fake_root = self.root / f"fake-bellman-{name}"
                fake_source = fake_root / "research" / "beliefs_2024"
                shutil.copytree(self.bellman_dir, fake_source)
                shutil.copyfile(
                    self.bellman_dir.parents[1] / "LICENSE", fake_root / "LICENSE"
                )
                target = fake_root / relative
                target.write_bytes(target.read_bytes() + b"\n")
                with self.assertRaisesRegex(ValueError, code):
                    export(
                        fake_source,
                        self.raw_data,
                        self.root / f"refused-{name}",
                        Path(__file__).resolve().parent,
                    )

    def test_reimport_refuses_undeclared_or_renamed_raw_data(self) -> None:
        undeclared = self.root / "undeclared-crate"
        shutil.copytree(self.crate, undeclared)
        (undeclared / "nested").mkdir()
        (undeclared / "nested" / "unexpected.txt").write_text("undeclared\n")
        with self.assertRaisesRegex(ValueError, "AFY_HANDOFF_UNDECLARED_ATTACHED_FILE"):
            reimport(
                undeclared,
                self.write_response(
                    self.response(undeclared), "undeclared-response.json"
                ),
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )

        renamed_raw = self.root / "renamed-raw-crate"
        shutil.copytree(self.crate, renamed_raw)
        (renamed_raw / "nested").mkdir()
        shutil.copyfile(self.raw_data, renamed_raw / "nested" / "opaque.bin")
        with self.assertRaisesRegex(ValueError, "AFY_HANDOFF_RAW_DATA_REDISTRIBUTED"):
            reimport(
                renamed_raw,
                self.write_response(
                    self.response(renamed_raw), "renamed-raw-response.json"
                ),
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )

    def test_reimport_refuses_relabelled_original_evidence(self) -> None:
        relabelled = self.root / "relabelled-crate"
        shutil.copytree(self.crate, relabelled)
        original_path = relabelled / "handoff" / "original-assessment.json"
        original = json.loads(original_path.read_text())
        original["evidence"]["portable_case_sha256"] = "0" * 64
        original_path.write_text(json.dumps(original, indent=2, sort_keys=True) + "\n")
        manifest_path = relabelled / "payload-manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["files"]["handoff/original-assessment.json"] = digest(original_path)
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        with self.assertRaisesRegex(
            ValueError, "AFY_HANDOFF_ORIGINAL_PORTABLE_CASE_MISMATCH"
        ):
            reimport(
                relabelled,
                self.write_response(
                    self.response(relabelled), "relabelled-response.json"
                ),
                digest(manifest_path),
                self.metadata_sha256,
            )

    def test_reimport_requires_issued_manifest_identity(self) -> None:
        rewritten = self.root / "rewritten-manifest-crate"
        shutil.copytree(self.crate, rewritten)
        result_path = (
            rewritten
            / "payload"
            / "bellman-afy-2024"
            / "first-results"
            / "results.json"
        )
        result_path.write_bytes(result_path.read_bytes() + b"\n")
        manifest_path = rewritten / "payload-manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["files"]["payload/bellman-afy-2024/first-results/results.json"] = (
            digest(result_path)
        )
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
        with self.assertRaisesRegex(
            ValueError, "AFY_HANDOFF_ISSUED_PAYLOAD_MANIFEST_MISMATCH"
        ):
            reimport(
                rewritten,
                self.write_response(
                    self.response(rewritten), "rewritten-manifest-response.json"
                ),
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )

    def test_reimport_requires_issued_metadata_identity(self) -> None:
        changed = self.root / "changed-metadata-crate"
        shutil.copytree(self.crate, changed)
        metadata_path = changed / "ro-crate-metadata.json"
        metadata_path.write_bytes(metadata_path.read_bytes() + b"\n")
        with self.assertRaisesRegex(ValueError, "AFY_HANDOFF_ISSUED_METADATA_MISMATCH"):
            reimport(
                changed,
                self.write_response(
                    self.response(changed), "changed-metadata-response.json"
                ),
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )

    def test_reimport_refuses_declared_symlink(self) -> None:
        changed = self.root / "symlink-crate"
        shutil.copytree(self.crate, changed)
        target = changed / "handoff" / "RECIPIENT_RESPONSE.md"
        external = self.root / "external-recipient-contract.md"
        shutil.copyfile(target, external)
        target.unlink()
        target.symlink_to(external)
        with self.assertRaisesRegex(
            ValueError, "AFY_HANDOFF_ATTACHED_SYMLINK_REJECTED"
        ):
            reimport(
                changed,
                self.write_response(self.response(changed), "symlink-response.json"),
                self.payload_manifest_sha256,
                self.metadata_sha256,
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bellman-dir", type=Path, required=True)
    parser.add_argument("--raw-data", type=Path, required=True)
    args, remaining = parser.parse_known_args()
    BoundaryTests.bellman_dir = args.bellman_dir
    BoundaryTests.raw_data = args.raw_data
    unittest.main(argv=[__file__, *remaining])


if __name__ == "__main__":
    main()
