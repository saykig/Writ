import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT } from "./fixtures.js";
const engineRoot = process.env.WRIT_DECISION_LAB_ROOT;
const python = process.env.WRIT_DECISION_LAB_PYTHON;
if (process.env.WRIT_REQUIRE_LINKED_EPISODES_INTEGRATION === "1" && (!engineRoot || !python))
  throw new Error("Real linked-episode receiving requires the pinned native backend.");
const integration = engineRoot && python ? test : test.skip;
integration(
  "relocated recipient receives external traces and freshly checks both native histories without producers",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "writ-linked-recipient-"));
    try {
      const fixtureDir = join(ROOT, "examples/decision-cases/linked-episodes");
      const raw = readFileSync(join(fixtureDir, "link.json"));
      const pins = JSON.parse(readFileSync(join(fixtureDir, "pins.json"), "utf8"));
      const file = join(dir, "link.json");
      writeFileSync(file, raw);
      const wrapper = join(dir, "check-only-python");
      writeFileSync(
        wrapper,
        '#!/bin/sh\nif [ "$4" = "solve" ]; then echo "producer disabled" >&2; exit 97; fi\nexec "$WRIT_DECISION_LAB_PYTHON" "$@"\n',
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          join(ROOT, "packages/shared-analysis/bin/writ-linked-episodes.ts"),
          file,
          pins.linkSha256,
          pins.parentSha256,
          pins.successorSha256,
          engineRoot!,
          wrapper,
        ],
        {
          cwd: dir,
          env: {
            ...process.env,
            WRIT_DECISION_LAB_PYTHON: python!,
            WRIT_DISABLE_EXTERNAL_PRODUCER: "1",
          },
          encoding: "utf8",
        },
      );
      expect(result.status, result.stderr).toBe(0);
      const receipt = JSON.parse(result.stdout);
      for (const side of ["parent", "successor"]) {
        expect(
          receipt.native_checks[side].fresh_checks.shared_analysis.freshly_checked,
        ).toHaveLength(2);
        expect(
          receipt.native_checks[side].fresh_checks.certificate_transport.transport_status,
        ).toBe("checked");
        expect(receipt.external_checks[side].assurance.bellman_certificate).toBe(false);
        expect(receipt.external_checks[side].assurance.model_empirically_validated).toBe(false);
      }
      expect(receipt.external_checks.successor.total_wait.value).toBe("10");
      expect(receipt.automatic_inferences.causality).toBe(false);
      const stale = spawnSync(
        process.execPath,
        [
          join(ROOT, "packages/shared-analysis/bin/writ-linked-episodes.ts"),
          file,
          pins.linkSha256,
          pins.successorSha256,
          pins.parentSha256,
          engineRoot!,
          wrapper,
        ],
        { cwd: dir, encoding: "utf8" },
      );
      expect(stale.status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
