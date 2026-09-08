import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  createVerifiedEngineSourceSnapshot,
  type VerifiedEngineSourceSnapshot,
} from "@writ/decision-case";

import { SharedAnalysisError } from "./errors.js";

const TRANSPORT_FILES: Readonly<Record<string, string>> = {
  "src/writ_decision_lab/transport/__init__.py": "88e4a41d645b1d7f948b4b82b25de55d0ceab169",
  "src/writ_decision_lab/transport/checker.py": "f2ef7d0a612ddc76c2ee829ad7af3917b7c24dfe",
  "src/writ_decision_lab/transport/exact.py": "09f97cec277c146a16a819e7041f85d948499639",
  "src/writ_decision_lab/transport/model.py": "700115d83b004aa9f05446deb99dd342ba4942f0",
  "src/writ_decision_lab/transport/producer.py": "142aae2aaa01c1ec5fbe0e74715d80fc7674bcd6",
};

function gitBlobSha(bytes: Uint8Array): string {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

/**
 * Extend the already verified Build 1/2 source-only snapshot with the exact Decision Lab PR #4
 * transport files. The Build 1/2 pin stays unchanged; transport is additive and separately pinned.
 */
export function createVerifiedTransportSourceSnapshot(
  suppliedEngineRoot: string,
): VerifiedEngineSourceSnapshot {
  const engineRoot = resolve(suppliedEngineRoot);
  const snapshot = createVerifiedEngineSourceSnapshot(engineRoot);
  try {
    for (const [relative, expectedBlob] of Object.entries(TRANSPORT_FILES)) {
      const source = join(engineRoot, relative);
      if (!existsSync(source)) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_TRANSPORT_ENGINE_UNAVAILABLE",
          `Pinned Decision Lab transport file is unavailable: ${relative}.`,
        );
      }
      const bytes = new Uint8Array(readFileSync(source));
      if (gitBlobSha(bytes) !== expectedBlob) {
        throw new SharedAnalysisError(
          "SHARED_ANALYSIS_TRANSPORT_ENGINE_PIN_MISMATCH",
          `Decision Lab transport file does not match the pinned PR #4 adapter: ${relative}.`,
        );
      }
      const destination = join(snapshot.root, relative);
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
    }
    return snapshot;
  } catch (error) {
    snapshot.dispose();
    throw error;
  }
}
