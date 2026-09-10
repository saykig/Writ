"""Run export and standard consumption, then optionally reimport a recipient response."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def invoke(command: list[str], *, cwd: Path | None = None) -> str:
    completed = subprocess.run(
        command, cwd=cwd, check=True, capture_output=True, text=True
    )
    return completed.stdout


def run(
    bellman_dir: Path,
    raw_data: Path,
    output: Path,
    consumer_python: Path,
    recipient_response: Path | None,
) -> dict[str, object]:
    output = output.resolve()
    if output.exists():
        raise ValueError("AFY_HANDOFF_OUTPUT_ALREADY_EXISTS")
    crate = output / "crate"
    output.mkdir(parents=True)
    export_result = json.loads(
        invoke(
            [
                sys.executable,
                str(HERE / "export_crate.py"),
                "--bellman-dir",
                str(bellman_dir),
                "--raw-data",
                str(raw_data),
                "--output",
                str(crate),
            ]
        )
    )

    with tempfile.TemporaryDirectory(prefix="writ-afy-rocrate-consumer-") as temporary:
        environment = Path(temporary) / "venv"
        invoke([str(consumer_python), "-m", "venv", str(environment)])
        python = environment / "bin" / "python"
        invoke(
            [
                str(python),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--no-deps",
                "--only-binary=:all:",
                "-r",
                str(HERE / "requirements-consumer.lock"),
            ]
        )
        consumer_output = output / "standard-consumer-report.json"
        invoke(
            [
                str(python),
                str(HERE / "standard_consumer.py"),
                str(crate),
                "--payload-manifest-sha256",
                str(export_result["payload_manifest_sha256"]),
                "--metadata-sha256",
                str(export_result["metadata_sha256"]),
                "--output",
                str(consumer_output),
            ],
            cwd=output,
        )
        installed = invoke([str(python), "-m", "pip", "freeze", "--all"]).splitlines()

    environment_receipt = {
        "schema": "example.afy2024.consumer-environment.v1",
        "interpreter": invoke([str(consumer_python), "--version"]).strip(),
        "requirements_lock": str(HERE / "requirements-consumer.lock"),
        "installed": installed,
        "separate_environment_removed_after_use": True,
    }
    (output / "consumer-environment.json").write_text(
        json.dumps(environment_receipt, indent=2, sort_keys=True) + "\n"
    )

    reimport_result = None
    state = "recipient_response_required"
    if recipient_response is not None:
        reimport_path = output / "reimported-assessment.json"
        invoke(
            [
                sys.executable,
                str(HERE / "reimport.py"),
                "--crate",
                str(crate),
                "--response",
                str(recipient_response),
                "--payload-manifest-sha256",
                str(export_result["payload_manifest_sha256"]),
                "--metadata-sha256",
                str(export_result["metadata_sha256"]),
                "--output",
                str(reimport_path),
            ]
        )
        reimport_result = json.loads(reimport_path.read_text())
        state = "complete"

    return {
        "schema": "example.afy2024.roundtrip-run.v1",
        "state": state,
        "export": export_result,
        "consumer_report": str(output / "standard-consumer-report.json"),
        "recipient_task": str(crate / "handoff" / "recipient-task.json"),
        "recipient_response_contract": str(crate / "handoff" / "RECIPIENT_RESPONSE.md"),
        "reimport": reimport_result,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bellman-dir", type=Path, required=True)
    parser.add_argument("--raw-data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--consumer-python", type=Path, default=Path(sys.executable))
    parser.add_argument("--recipient-response", type=Path)
    args = parser.parse_args()
    print(
        json.dumps(
            run(
                args.bellman_dir,
                args.raw_data,
                args.output,
                args.consumer_python,
                args.recipient_response,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
