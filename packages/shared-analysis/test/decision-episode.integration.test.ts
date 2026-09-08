import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { parseExecution, verifyEncodedBytes } from "@writ/decision-case";

import { buildDecisionEpisodeStory } from "../../../examples/decision-cases/decision-episode/generate.js";
import {
  decisionEpisodeBytes,
  openCertificateTransportRecord,
  openSharedAnalysis,
  type DecisionEpisodeReplay,
} from "../src/index.js";
import { ROOT } from "./fixtures.js";

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const pythonExecutable = process.env.WRIT_DECISION_LAB_PYTHON;
const integrationRequired = process.env.WRIT_REQUIRE_DECISION_EPISODE_INTEGRATION === "1";

if (integrationRequired && (engineRoot === undefined || pythonExecutable === undefined)) {
  throw new Error(
    "Decision-episode integration prerequisites are required: set WRIT_DECISION_LAB_ROOT and WRIT_DECISION_LAB_PYTHON.",
  );
}

const integration = engineRoot !== undefined && pythonExecutable !== undefined ? test : test.skip;

integration(
  "closes one checked-to-observed episode and freshly replays every mathematical artifact checker-only",
  () => {
    const episode = buildDecisionEpisodeStory({
      engineRoot: engineRoot!,
      pythonExecutable: pythonExecutable!,
    });
    const transport = openCertificateTransportRecord(
      verifyEncodedBytes(
        episode.value.checked_history.certificate_transport_record,
        "episode transport",
      ),
    );
    const workspace = openSharedAnalysis(
      verifyEncodedBytes(transport.value.shared_analysis, "episode shared analysis"),
    );
    const successor = workspace.value.executions.find(
      ({ revision_id }) => revision_id === "revision.x-half-v3",
    );
    expect(successor).toBeDefined();
    const successorExecution = parseExecution(
      verifyEncodedBytes(successor!.execution, "episode successor execution"),
    );
    expect(successorExecution.mathematical_check.result).toEqual(
      expect.objectContaining({
        status: "uniformly_strictly_optimal",
        conclusion: expect.objectContaining({ common_minimizers: ["B"] }),
      }),
    );
    expect(episode.value.human_decision).toEqual(
      expect.objectContaining({
        selected_action: "A",
        mathematical_role: "considered_not_authorizing",
      }),
    );
    expect(episode.value.interpretations).toEqual([]);
    expect(decisionEpisodeBytes(episode)).toEqual(
      new Uint8Array(
        readFileSync(join(ROOT, "examples", "decision-cases", "decision-episode", "episode.json")),
      ),
    );

    const recipientRoot = mkdtempSync(join(tmpdir(), "writ-decision-episode-recipient-"));
    try {
      const episodePath = join(recipientRoot, "episode.json");
      const checkOnlyPython = join(recipientRoot, "check-only-python");
      writeFileSync(episodePath, decisionEpisodeBytes(episode), { flag: "wx" });
      writeFileSync(
        checkOnlyPython,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "episode replay attempted producer solve" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          join(ROOT, "packages", "shared-analysis", "bin", "writ-decision-episode.ts"),
          "replay",
          "--episode",
          episodePath,
          "--engine-root",
          engineRoot!,
          "--python",
          checkOnlyPython,
        ],
        {
          encoding: "utf8",
          env: { ...process.env, WRIT_DECISION_LAB_PYTHON: pythonExecutable! },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      const replay = JSON.parse(result.stdout) as DecisionEpisodeReplay;
      expect(replay.episode_sha256).toBe(episode.episode_sha256);
      expect(replay.fresh_checks.shared_analysis.freshly_checked).toHaveLength(2);
      expect(
        replay.fresh_checks.shared_analysis.freshly_checked.map(({ revision_id }) => revision_id),
      ).toEqual([null, "revision.x-half-v3"]);
      expect(replay.fresh_checks.certificate_transport).toEqual(
        expect.objectContaining({
          source_certificate_bytes_preserved: true,
          source_certificate_status: "checked",
          target_certificate_status: "checked",
          transport_status: "checked",
          mathematical_status: "checked",
        }),
      );
      expect(replay.preserved_declarations.interpretation_sha256s).toEqual([]);
      expect(replay.automatic_inferences).toEqual({
        decision_from_mathematics: false,
        causality_from_observation: false,
        decision_correctness_from_observation: false,
        model_update_from_observation: false,
      });
    } finally {
      rmSync(recipientRoot, { recursive: true, force: true });
    }
  },
);
