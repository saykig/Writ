// Deliverable generator.
//
// Writes the frozen benchmark data artifacts from the reviewed catalog:
//   - benchmark/2025-ai-sme/sources.json                 (source manifest)
//   - benchmark/2025-ai-sme/methodology-inventory.json   (governed methodology)
//   - benchmark/2025-ai-sme/evidence/<member>.snapshot.json  (8 snapshots)
//   - benchmark/2025-ai-sme/profiles/<name>.profile.json     (2 profiles)
//
// Every artifact is validated against its `@writ/domain` schema before it is
// written, so a generation that succeeds cannot emit an invalid deliverable.

import { mkdirSync, writeFileSync } from "node:fs";
import { assertValid, validate, type Evidence } from "@writ/domain";
import { MEMBERS } from "./members.js";
import { buildMemberSnapshot, buildSourceManifest, sourceDocumentVersion } from "./evidence.js";
import { buildMethodologyInventory } from "./inventory.js";
import { buildProfile } from "./profiles.js";
import {
  EVIDENCE_DIR,
  INVENTORY_PATH,
  PROFILES_DIR,
  SOURCES_PATH,
  profilePath,
  snapshotPath,
} from "./paths.js";

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

/** Generate and validate every benchmark data artifact. Returns the file paths. */
export function generateArtifacts(): string[] {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  mkdirSync(PROFILES_DIR, { recursive: true });
  const written: string[] = [];

  // Source manifest (validate its document + passages via a probe snapshot).
  const manifest = buildSourceManifest();
  const probe: Evidence = {
    schema_version: "1.0.0",
    snapshot: {
      id: "probe",
      frozen_at: "2026-06-13T00:00:00Z",
      cutoff: "2026-06-01T00:00:00Z",
      content_hash: "sha256:" + "0".repeat(64),
    },
    document_versions: [sourceDocumentVersion()],
    passages: manifest.passages,
    claims: [],
    actions: [],
    reviews: [],
  };
  const probeResult = validate("evidence", probe);
  if (!probeResult.valid) {
    throw new Error(
      `sources.json document/passages are not schema-valid: ${JSON.stringify(probeResult.errors)}`,
    );
  }
  writeJson(SOURCES_PATH, manifest);
  written.push(SOURCES_PATH);

  // Methodology inventory.
  const inventory = buildMethodologyInventory();
  assertValid("methodology-inventory", inventory);
  writeJson(INVENTORY_PATH, inventory);
  written.push(INVENTORY_PATH);

  // Evidence snapshots (one per member).
  for (const member of MEMBERS) {
    const snapshot = buildMemberSnapshot(member);
    assertValid("evidence", snapshot);
    const path = snapshotPath(member.id);
    writeJson(path, snapshot);
    written.push(path);
  }

  // Interpretation profiles.
  for (const kind of ["published", "generous"] as const) {
    const profile = buildProfile(kind);
    assertValid("interpretation-profile", profile);
    const path = profilePath(kind);
    writeJson(path, profile);
    written.push(path);
  }

  return written;
}

if (import.meta.main) {
  const written = generateArtifacts();
  process.stdout.write(`Generated ${written.length} artifacts:\n${written.join("\n")}\n`);
}
