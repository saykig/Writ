import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { ROOT } from "./fixtures.js";

const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const python = process.env.WRIT_DECISION_LAB_PYTHON;
if (process.env.WRIT_REQUIRE_SIMULATION_DECISION_INTEGRATION === "1" && (!engineRoot || !python)) {
  throw new Error("Real simulation-decision receiving requires the pinned native backend.");
}
const integration = engineRoot && python ? test : test.skip;

integration(
  "relocated producer-disabled recipient freshly checks both comparisons, episodes and dispositions",
  () => {
    const directory = mkdtempSync(join(tmpdir(), "writ-simulation-decision-recipient-"));
    try {
      const fixtureDirectory = join(ROOT, "examples/decision-cases/simulation-decision");
      const raw = readFileSync(join(fixtureDirectory, "revision.json"));
      const pins = JSON.parse(readFileSync(join(fixtureDirectory, "pins.json"), "utf8"));
      const file = join(directory, "revision.json");
      writeFileSync(file, raw);
      const wrapper = join(directory, "check-only-python");
      writeFileSync(
        wrapper,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "producer disabled" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );
      const args = [
        join(ROOT, "packages/shared-analysis/bin/writ-simulation-decision.ts"),
        file,
        pins.revisionSha256,
        pins.parentComparisonSha256,
        pins.successorComparisonSha256,
        pins.parentEpisodeSha256,
        pins.successorEpisodeSha256,
        engineRoot!,
        wrapper,
      ];
      const result = spawnSync(process.execPath, args, {
        cwd: directory,
        env: {
          ...process.env,
          WRIT_DECISION_LAB_PYTHON: python!,
          WRIT_DISABLE_EXTERNAL_PRODUCER: "1",
        },
        encoding: "utf8",
      });
      expect(result.status, result.stderr).toBe(0);
      const receipt = JSON.parse(result.stdout);
      expect(receipt.ranking_change.prior_preferred_option_ids).toEqual(["retain"]);
      expect(receipt.ranking_change.successor_preferred_option_ids).toEqual(["intensive"]);
      expect(receipt.preserved_human_dispositions.successor.status).toBe(
        "deferred_or_outside_modeled_menu",
      );
      expect(receipt.model_and_objective_checks.successor.objective_empirically_identified).toBe(
        false,
      );
      expect(receipt.automatic_inferences.decision_from_recommendation).toBe(false);
      for (const side of ["parent", "successor"]) {
        expect(
          receipt.native_checks[side].fresh_checks.shared_analysis.freshly_checked,
        ).toHaveLength(2);
        expect(
          receipt.native_checks[side].fresh_checks.certificate_transport.transport_status,
        ).toBe("checked");
      }
      const staleArgs = [...args];
      staleArgs[2] = `sha256:${"0".repeat(64)}`;
      const stale = spawnSync(process.execPath, staleArgs, {
        cwd: directory,
        encoding: "utf8",
      });
      expect(stale.status).toBe(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
