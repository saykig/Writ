/**
 * Frozen-evidence re-derivation harness (pilot next-step 2).
 *
 * Proves that every content hash and every score in the 2025 AI-for-SMEs corpus
 * re-derives from the bytes already in the repository — no network, no seed. It
 * recomputes, from the frozen artifacts alone:
 *
 *   1. the source document hash  (raw SHA-256 of the PDF bytes);
 *   2. each snapshot content_hash = sha256Canonical({passages, claims, actions, reviews});
 *   3. each interpretation-profile canonical_hash;
 *   4. the benchmark result (the deterministic evaluator over the frozen evidence).
 *
 * A mismatch localizes the divergence to a specific artifact. What a matching
 * hash does NOT prove is covered in docs/REPLICATION.md (e.g. a passage's
 * anchor_hash also folds in a footnote that is not stored in the snapshot).
 *
 * Run: `bun scripts/replicate.ts` (exits non-zero on any divergence).
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { sha256Canonical } from "@writ/provenance";
import { verifyReceipt } from "@writ/evaluator";
import { BENCHMARK_DIR, EVIDENCE_DIR, PROFILES_DIR } from "./paths.js";
import { runBenchmark } from "./run.js";

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/** Recompute a snapshot's content_hash from its own arrays (the stored recipe). */
export function recomputeContentHash(snapshot: {
  passages: unknown;
  claims: unknown;
  actions: unknown;
  reviews: unknown;
}): string {
  const { passages, claims, actions, reviews } = snapshot;
  return sha256Canonical({ passages, claims, actions, reviews });
}

/** Re-derive every hash and score from the frozen corpus; one Check per artifact. */
export function replicate(): Check[] {
  const checks: Check[] = [];
  const snapshotFiles = readdirSync(EVIDENCE_DIR)
    .filter((file) => file.endsWith(".snapshot.json"))
    .sort();

  // 1 + 2. Source bytes and per-snapshot content hashes.
  let sourceChecked = false;
  for (const file of snapshotFiles) {
    const snapshot = readJson<Record<string, unknown>>(join(EVIDENCE_DIR, file));
    const header = snapshot.snapshot as { content_hash: string };
    const recomputed = recomputeContentHash(
      snapshot as unknown as {
        passages: unknown;
        claims: unknown;
        actions: unknown;
        reviews: unknown;
      },
    );
    checks.push({
      name: `content_hash ${file}`,
      ok: recomputed === header.content_hash,
      ...(recomputed === header.content_hash
        ? {}
        : { detail: `recomputed ${recomputed} ≠ stored ${header.content_hash}` }),
    });

    // The frozen PDF, verified once against the shared document version.
    if (!sourceChecked) {
      const docVersions = snapshot.document_versions as { uri?: string; sha256: string }[];
      const doc = docVersions[0];
      if (doc) {
        const pdfPath = join(BENCHMARK_DIR, "sources", "g7-2025-ai-sme-chapter.pdf");
        try {
          const bytes = readFileSync(pdfPath);
          const raw = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
          checks.push({
            name: "source document sha256",
            ok: raw === doc.sha256,
            ...(raw === doc.sha256 ? {} : { detail: `recomputed ${raw} ≠ stored ${doc.sha256}` }),
          });
        } catch (error) {
          checks.push({ name: "source document sha256", ok: false, detail: String(error) });
        }
        sourceChecked = true;
      }
    }
  }

  // 3. Interpretation-profile canonical hashes (self-referential envelope
  //    dropped, matching how the stored canonical_hash was produced).
  for (const file of readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const profile = readJson<Record<string, unknown>>(join(PROFILES_DIR, file));
    const stored = profile.canonical_hash as string;
    const recomputed = sha256Canonical(profile, { dropFields: ["/canonical_hash", "/signature"] });
    checks.push({
      name: `profile canonical_hash ${file}`,
      ok: recomputed === stored,
      ...(recomputed === stored ? {} : { detail: `recomputed ${recomputed} ≠ stored ${stored}` }),
    });
  }

  // 4. The benchmark re-derives from the frozen evidence (8/8, deterministic),
  //    and every receipt's content hash verifies.
  const { ledger, receipts } = runBenchmark();
  const summary = ledger.summary;
  const reproduces = summary.matches === summary.cells && summary.mismatches === 0;
  checks.push({
    name: `benchmark reproduces (${summary.matches}/${summary.cells})`,
    ok: reproduces,
    ...(reproduces ? {} : { detail: `${summary.mismatches} mismatch(es)` }),
  });

  for (const [subject, receipt] of receipts) {
    const verification = verifyReceipt(receipt);
    checks.push({
      name: `receipt verifies ${subject}`,
      ok: verification.valid,
      ...(verification.valid
        ? {}
        : { detail: `expected ${verification.expected} ≠ actual ${verification.actual}` }),
    });
  }

  return checks;
}
