import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { sha256Bytes } from "@writ/provenance";

import { DecisionCaseError } from "./errors.js";

const ENGINE_FILES: Readonly<Record<string, string>> = {
  "src/writ_decision_lab/__init__.py":
    "sha256:fec4b7269d86b96269e8a30d2b4cc79c7ca83873fd6b49979c1f0442494edd36",
  "src/writ_decision_lab/checker.py":
    "sha256:84a511de331c7a0c834c1a0c691409af309f72bc5df8808da0a01b473ad59867",
  "src/writ_decision_lab/consumer.py":
    "sha256:3ffd71e16c803538f382e72d9f73a74ddf10ead2de5a722e359bd95a4084b665",
  "src/writ_decision_lab/decode.py":
    "sha256:4c1df7eb782878bb6689cad7e04e7ba890f660987fde1a42f355bd7c31685061",
  "src/writ_decision_lab/errors.py":
    "sha256:df1e265fb690ccfb5022b43ff8dcceed2dd485bbba70905a40a71d4dc37bf060",
  "src/writ_decision_lab/identity.py":
    "sha256:ce94c91047475ab201447a5c8d0d31895b06c17e25094e5e43cb5acfe6000440",
  "src/writ_decision_lab/solver.py":
    "sha256:033c8da77caa5176b713103b33cdf443051c84585e362ac2e7886149a9bf23ec",
  "src/writ_decision_lab/types.py":
    "sha256:57808d0eef3c9d65849d3a9cc7aebd736240a0d5962a0aeb7976d74fcc9a21b9",
  "src/writ_decision_lab/build2/__init__.py":
    "sha256:8cfc1091f474dcccde373b2837129c3807a9afa5ab5518882bd12b6de8361df7",
  "src/writ_decision_lab/build2/backend.py":
    "sha256:43f2ddf2753244cddca20e82308d05874620ba08e03370b37b5096673dbd5edf",
  "src/writ_decision_lab/build2/checker.py":
    "sha256:d2377dabe4feb8b4b3e3ceb7a7626b0b90afe642d1ce58db9b11215c8ef58ef4",
  "src/writ_decision_lab/build2/consumer.py":
    "sha256:928fed6adc106ac0027cb4de9e2513f34138b16b85b4553d724b3e7a894e837b",
  "src/writ_decision_lab/build2/engine.py":
    "sha256:87930f266b3a73ca906dd93056f4e91a98fc2493cb11c604b42d9e828c83a7da",
  "src/writ_decision_lab/build2/errors.py":
    "sha256:b34d0f621a0a0925ceb78890edc59079b980903f8dbc58e827dd68ca0d0c7847",
  "src/writ_decision_lab/build2/exact.py":
    "sha256:a6a1b3bc27327a2a90de71bde59428a991f041f7235633e007235b89a388e5d4",
  "src/writ_decision_lab/build2/model.py":
    "sha256:7656d7fb93186617481390e9445752bf00451a5a0bed00a5e89566ebfb6e3924",
};

export const PINNED_ENGINE_SOURCE_PATHS = Object.freeze(Object.keys(ENGINE_FILES));
export const VERIFIED_ENGINE_SNAPSHOT_PREFIX = "writ-decision-engine-";

export interface VerifiedEngineSourceSnapshot {
  readonly root: string;
  readonly sourceRoot: string;
  dispose(): void;
}

/**
 * Copy only the exact source buffers that passed the engine pin into a private execution tree.
 * The caller's directory is an input source, never an import root.
 */
export function createVerifiedEngineSourceSnapshot(
  suppliedEngineRoot: string,
): VerifiedEngineSourceSnapshot {
  const engineRoot = resolve(suppliedEngineRoot);
  const verifiedFiles = PINNED_ENGINE_SOURCE_PATHS.map((relative) => {
    const path = join(engineRoot, relative);
    if (!existsSync(path)) {
      throw new DecisionCaseError(
        "DECISION_CASE_ENGINE_UNAVAILABLE",
        `Pinned Decision Lab file is unavailable: ${relative}.`,
      );
    }
    const bytes = new Uint8Array(readFileSync(path));
    if (sha256Bytes(bytes) !== ENGINE_FILES[relative]) {
      throw new DecisionCaseError(
        "DECISION_CASE_ENGINE_PIN_MISMATCH",
        `Decision Lab file does not match the pinned interface: ${relative}.`,
      );
    }
    return { relative, bytes };
  });

  const snapshotRoot = mkdtempSync(join(tmpdir(), VERIFIED_ENGINE_SNAPSHOT_PREFIX));
  try {
    for (const { relative, bytes } of verifiedFiles) {
      const destination = join(snapshotRoot, relative);
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      writeFileSync(destination, bytes, { flag: "wx", mode: 0o600 });
    }
  } catch (error) {
    rmSync(snapshotRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    root: snapshotRoot,
    sourceRoot: join(snapshotRoot, "src"),
    dispose(): void {
      rmSync(snapshotRoot, { recursive: true, force: true });
    },
  };
}
