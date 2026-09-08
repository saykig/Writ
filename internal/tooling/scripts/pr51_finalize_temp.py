from __future__ import annotations

import hashlib
from pathlib import Path
import subprocess
import sys

TASK_ID = "CERTIFICATE-TRANSPORT-INTEGRATION-001"
SELF = "internal/tooling/scripts/pr51_finalize_temp.py"

NEW_TASK = """  - id: CERTIFICATE-TRANSPORT-INTEGRATION-001
    title: Bind a transported mathematical guarantee to an accepted revision lifecycle
    status: review
    implementation_pr: https://github.com/saykig/Writ/pull/51
    architecture_status: retained_narrowly
    baseline_commit: bb4534249a313c92a045edd7f9462ff77fbb1bdb
    external_pins:
      decision_lab: e5f77dfcf929708951f4673b3f394461ef09c752
      bellman: aae1b56276b231d16748473f4a54dd4a9ea514cf
    dependencies:
      - SHARED-ANALYSIS-REVISION-001
    completion_note: >-
      ADR 0026 and ADR 0028 are Accepted. The trial reuses PR 47's revision/reassessment authority,
      adds one separately pinned Bellman certificate-transport attachment, preserves exact old and
      successor certificate identities, and separates target-certificate validity from transport
      provenance. A private Decision Lab validation run against Writ commit
      dccd5908debc6f364723a69d15a0364aea4acd00 passed Decision Case 16/16, Shared Analysis 2/2,
      and Certificate Transport 4/4 with zero skips. The reusable semantic is retained narrowly as a
      revision-bound checked mathematical transition; no subsequent Bellman component is authorized
      by this result.
    scope:
      - Preserve an old checked result and exact source certificate under their historical premises.
      - Require a substantive model or policy revision with changed successor subject and stale applicability.
      - Require a current supported reassessment before constructing a transported successor guarantee.
      - Bind an explicit model-to-request mapping premise to exact request fields that demonstrably changed.
      - Preserve exact request, evidence, source certificate, successor certificate, and checker identities.
      - Reopen the record in a fresh recipient and run checker-only replay for the mathematical transition.
      - Compare the Writ lifecycle with direct Bellman/Decision Lab use before deciding whether to retain the semantic.
    exclusions:
      - Automatic evidence-to-model mapping, inferred source-to-cost translation, or automatic transport on every dependency change.
      - Certificate accumulation, policy selection, structural transport, persistent model families, replanning, causal, statistical, strategic, safety, or authority semantics.
      - A general certificate registry, solver registry, database, service, language migration, or automatic next Bellman transfer.
    acceptance:
      - ADR 0026 and ADR 0028 are explicitly Accepted before the new transfer is treated as usable architecture.
      - Transport is refused before supported reassessment, for no-op or label-only changes, and when a declared changed request field did not actually change.
      - The source certificate remains preserved and checked; target-certificate validity and transport provenance remain distinct independently checked statuses.
      - Recipient replay invokes only the checker on preserved transport evidence and separately rechecks the old and successor PR 47 executions.
      - Real no-skip Decision Lab integration passes for Decision Case, Shared Analysis, and Certificate Transport against the exact pinned merge commit.
      - Standard repository format, lint, typecheck, test, data, Writ verification, build, Python, pack, and source-registry gates pass on the final tree.
      - The final report retains the revision-bound checked mathematical transition and explicitly stops before automatic certificate accumulation or another Bellman port.
    outputs:
      - adr/0026-bounded-derived-decision-cases.md
      - adr/0028-shared-analysis-revision.md
      - packages/shared-analysis
      - schemas/analysis/certificate-transport-integration-v0.1.schema.json
      - docs/current/decision-cases.md
      - docs/current/shared-analysis-revision.md
      - docs/current/product-definition.md
      - docs/current/roadmap.md
      - docs/experiments/certificate-transport-integration-report.md
      - TASKS.yaml
      - MANIFEST.sha256

"""


def update_tasks() -> None:
    path = Path("TASKS.yaml")
    text = path.read_text()

    shared_start = text.index("  - id: SHARED-ANALYSIS-REVISION-001\n")
    shared_end = text.index("\n  - id: ROOT-HYGIENE-HISTORY-SNAPSHOTS-001\n", shared_start)
    shared = text[shared_start:shared_end]
    shared = shared.replace("    status: review\n", "    status: done\n", 1)
    shared = shared.replace("    architecture_status: proposed\n", "    architecture_status: accepted\n", 1)
    shared = shared.replace(
        "      successors; all repository gates pass and ADR 0028 remains Proposed.\n",
        "      successors. PR 47 is merged, the bounded lifecycle passed its human gate, and ADR 0028 is Accepted.\n",
    )
    shared = shared.replace(
        "      - The implementation comparison records exact candidate commits, adapted components and reasons for declined dependencies; the governing ADR remains Proposed.\n",
        "      - The implementation comparison records exact candidate commits, adapted components and reasons for declined dependencies; ADR 0028 is Accepted after the completed human gate.\n",
    )
    text = text[:shared_start] + shared + text[shared_end:]

    executable_start = text.index("  - id: EXECUTABLE-DECISION-CASE-001\n")
    executable_end = text.index(
        "\n  - id: TRACK-B-HISTORICAL-JUDGMENT-TARGET-SCOPE-001\n", executable_start
    )
    executable = text[executable_start:executable_end]
    executable = executable.replace("    architecture_status: proposed\n", "    architecture_status: accepted\n", 1)
    executable = executable.replace(
        "      The bounded implementation is merged on main. ADR 0026 remains Proposed pending explicit\n"
        "      human architectural disposition; implementation does not constitute that acceptance.\n",
        "      The bounded implementation is merged on main. ADR 0026 is Accepted after PR 43 and PR 47\n"
        "      supplied the execution, revision, handoff, and hardening evidence required by the human gate.\n",
    )
    executable = executable.replace(
        "      - The implementation, current instructions, compact execution/comparison record and exact external pins are present on main through PR #43; ADR 0026 remains Proposed pending explicit human architectural disposition.\n",
        "      - The implementation, current instructions, compact execution/comparison record and exact external pins are present on main through PR #43; ADR 0026 is Accepted after the completed human gate.\n",
    )
    text = text[:executable_start] + executable + text[executable_end:]

    if f"  - id: {TASK_ID}\n" not in text:
        marker = "tasks:\n"
        insert_at = text.index(marker) + len(marker)
        text = text[:insert_at] + NEW_TASK + text[insert_at:]

    path.write_text(text)


def regenerate_manifest() -> None:
    raw_names = subprocess.check_output(["git", "ls-files", "-z"]).split(b"\0")
    excluded = {"MANIFEST.sha256", SELF}
    names = sorted(raw.decode() for raw in raw_names if raw and raw.decode() not in excluded)
    lines = []
    for name in names:
        digest = hashlib.sha256(Path(name).read_bytes()).hexdigest()
        lines.append(f"{digest}  {name}\n")
    Path("MANIFEST.sha256").write_text("".join(lines))


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"tasks", "manifest"}:
        raise SystemExit("usage: pr51_finalize_temp.py tasks|manifest")
    if sys.argv[1] == "tasks":
        update_tasks()
    else:
        regenerate_manifest()


if __name__ == "__main__":
    main()
