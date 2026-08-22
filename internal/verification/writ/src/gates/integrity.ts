import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { findObjects } from "../repository.js";
import {
  gateResult,
  issue,
  type CorpusManifest,
  type RepositorySnapshot,
  type VerificationGateResult,
  type VerificationIssue,
} from "../types.js";

function arraysIn(
  documents: RepositorySnapshot["documents"],
  corpusId: string,
  key: string,
): unknown[] {
  return documents
    .filter((document) => document.corpus_id === corpusId)
    .flatMap((document) => (Array.isArray(document.value[key]) ? document.value[key] : []));
}

function recordCount(
  snapshot: RepositorySnapshot,
  manifest: CorpusManifest,
  key: string,
): number | undefined {
  const corpusId = manifest.corpus_id;
  const records = snapshot.records
    .filter((item) => item.corpus_id === corpusId)
    .map((item) => item.value);
  const links = snapshot.links
    .filter((item) => item.value.owning_corpus_id === corpusId)
    .map((item) => item.value);
  const judgments = snapshot.judgments
    .filter((item) => item.corpus_id === corpusId)
    .map((item) => item.value);
  const sources = arraysIn(snapshot.documents, corpusId, "sources") as Array<
    Record<string, unknown>
  >;
  const values: Record<string, number> = {
    institutional_records: records.filter((record) => record.family === "institutional").length,
    legal_policy_records: records.filter((record) => record.family === "legal_policy").length,
    record_links: links.length,
    disposition_judgments: judgments.length,
    sources: sources.length,
    verified_source_documents: sources.filter((source) => source.verification_status === "verified")
      .length,
    unresolved_sources: sources.filter((source) => source.verification_status !== "verified")
      .length,
    passages: arraysIn(snapshot.documents, corpusId, "passages").length,
    entities: arraysIn(snapshot.documents, corpusId, "entities").length,
    claims: arraysIn(snapshot.documents, corpusId, "claims").length,
    relationships: arraysIn(snapshot.documents, corpusId, "relationships").length,
    imported_parent_reviews: arraysIn(snapshot.documents, corpusId, "reviews").length,
    legacy_mappings: arraysIn(snapshot.documents, corpusId, "entries").length,
  };
  return values[key];
}

function reviewCount(
  snapshot: RepositorySnapshot,
  manifest: CorpusManifest,
  key: string,
): number | undefined {
  const corpusId = manifest.corpus_id;
  const records = snapshot.records
    .filter((item) => item.corpus_id === corpusId)
    .map((item) => item.value);
  const links = snapshot.links
    .filter((item) => item.value.owning_corpus_id === corpusId)
    .map((item) => item.value);
  const judgments = snapshot.judgments
    .filter((item) => item.corpus_id === corpusId)
    .map((item) => item.value);
  const claims = arraysIn(snapshot.documents, corpusId, "claims") as Array<Record<string, unknown>>;
  const parentReviews = arraysIn(snapshot.documents, corpusId, "reviews") as Array<
    Record<string, unknown>
  >;
  const values: Record<string, number> = {
    approved_records: records.filter((record) => record.review_state === "approved").length,
    superseded_records: records.filter((record) => record.review_state === "superseded").length,
    draft_records: records.filter((record) => record.review_state === "draft").length,
    approved_record_links: links.filter((link) => link.review_state === "approved").length,
    draft_record_links: links.filter((link) => link.review_state === "draft").length,
    accepted_disposition_judgments: judgments.filter((judgment) => judgment.status === "accepted")
      .length,
    proposed_disposition_judgments: judgments.filter((judgment) => judgment.status === "proposed")
      .length,
    superseded_disposition_judgments: judgments.filter(
      (judgment) => judgment.status === "superseded",
    ).length,
    accepted_parent_reviews: parentReviews.filter(
      (review) =>
        review.review_decision === "accepted" ||
        review.decision === "accept" ||
        review.status === "accepted",
    ).length,
    accepted_claims: claims.filter(
      (claim) => claim.review_status === "accepted" || claim.status === "accepted",
    ).length,
  };
  return values[key];
}

export interface ChecksumInput {
  root: string;
  manifestText: string;
  trackedFiles: string[];
}

export function checkManifestChecksum(input: ChecksumInput): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const entries = new Map<string, string>();
  for (const [index, line] of input.manifestText.split(/\r?\n/).entries()) {
    if (line.length === 0) continue;
    const match = /^([0-9a-f]{64})[ ]{2}(.+)$/.exec(line);
    if (!match) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Malformed checksum line ${index + 1}.`,
          { file: "MANIFEST.sha256" },
        ),
      );
      continue;
    }
    const [, hash, file] = match;
    if (entries.has(file!)) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Duplicate checksum entry for ${file}.`,
          { file: "MANIFEST.sha256" },
        ),
      );
    }
    entries.set(file!, hash!);
  }
  const expected = new Set(input.trackedFiles.filter((file) => file !== "MANIFEST.sha256"));
  for (const file of expected) {
    if (!entries.has(file)) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Tracked file is absent from MANIFEST.sha256: ${file}`,
          { file },
        ),
      );
      continue;
    }
    const absolute = join(input.root, file);
    if (!existsSync(absolute)) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Tracked file does not exist: ${file}`,
          { file },
        ),
      );
      continue;
    }
    const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
    if (actual !== entries.get(file)) {
      issues.push(
        issue("integrity", "INTEGRITY_CHECKSUM_MISMATCH", `Checksum mismatch for ${file}.`, {
          file,
        }),
      );
    }
  }
  for (const file of entries.keys()) {
    if (!expected.has(file)) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Checksum entry is not a tracked file: ${file}`,
          { file },
        ),
      );
    }
  }
  return issues;
}

export function normalizeCommandOutput(root: string, output: string): string {
  const aliases = new Set([resolve(root)]);
  try {
    aliases.add(realpathSync(root));
  } catch {
    // The command failure is reported by its caller; normalization stays pure.
  }
  return [...aliases]
    .sort((left, right) => right.length - left.length)
    .reduce(
      (text, absolute) => text.split(absolute).join("<workspace>"),
      output.replace(/\r\n/g, "\n"),
    )
    .trim();
}

function command(
  root: string,
  executable: string,
  args: string[],
  env: Record<string, string | undefined> = process.env,
): { ok: boolean; output: string } {
  const result = Bun.spawnSync([executable, ...args], {
    cwd: root,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    ok: result.exitCode === 0,
    output: normalizeCommandOutput(root, `${result.stdout.toString()}${result.stderr.toString()}`),
  };
}

export interface IntegrityOptions {
  runExternalChecks?: boolean;
}

export function verifyIntegrity(
  snapshot: RepositorySnapshot,
  options: IntegrityOptions = {},
): VerificationGateResult {
  const issues = [...snapshot.loadIssues];
  for (const loaded of snapshot.manifests) {
    const manifest = loaded.value;
    for (const [key, expected] of Object.entries(manifest.record_counts)) {
      const actual = recordCount(snapshot, manifest, key);
      if (actual !== undefined && actual !== expected) {
        issues.push(
          issue(
            "integrity",
            "INTEGRITY_COUNT_MISMATCH",
            `${key}: manifest declares ${expected}, loaded ${actual}.`,
            { corpus_id: manifest.corpus_id, file: loaded.file },
          ),
        );
      }
    }
    for (const [key, expected] of Object.entries(manifest.review_counts)) {
      const actual = reviewCount(snapshot, manifest, key);
      if (actual !== undefined && actual !== expected) {
        issues.push(
          issue(
            "integrity",
            "INTEGRITY_REVIEW_COUNT_MISMATCH",
            `${key}: manifest declares ${expected}, loaded ${actual}.`,
            { corpus_id: manifest.corpus_id, file: loaded.file },
          ),
        );
      }
    }
  }

  const institutionalSymbols = new Set(
    snapshot.institutionalRecords.flatMap(({ value }) => [
      value.institution_id,
      ...(value.parent_institution_id ? [value.parent_institution_id] : []),
    ]),
  );
  for (const loaded of snapshot.links.filter(
    ({ value }) => value.review_state !== "superseded" && value.review_state !== "withdrawn",
  )) {
    const sourceKnown =
      findObjects(snapshot, loaded.value.source_id).length > 0 ||
      institutionalSymbols.has(loaded.value.source_id);
    const targetKnown =
      findObjects(snapshot, loaded.value.target_id).length > 0 ||
      institutionalSymbols.has(loaded.value.target_id);
    if (!sourceKnown || !targetKnown) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_DANGLING_REFERENCE",
          `Active link ${loaded.value.link_id} has an unresolved ${!sourceKnown ? "source" : "target"} endpoint.`,
          {
            corpus_id: loaded.value.owning_corpus_id,
            object_id: loaded.value.link_id,
            file: loaded.file,
          },
        ),
      );
    }
  }

  if (options.runExternalChecks !== false) {
    const git = command(snapshot.root, "git", ["ls-files"]);
    if (!git.ok) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_CHECKSUM_INVENTORY_MISMATCH",
          `Cannot enumerate tracked files: ${git.output}`,
          { file: "MANIFEST.sha256" },
        ),
      );
    } else {
      issues.push(
        ...checkManifestChecksum({
          root: snapshot.root,
          manifestText: readFileSync(join(snapshot.root, "MANIFEST.sha256"), "utf8"),
          trackedFiles: git.output.split(/\r?\n/).filter(Boolean),
        }),
      );
    }
    const virtualPython = join(
      snapshot.root,
      ".venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
    );
    const python =
      process.env.PYTHON_BIN ?? (existsSync(virtualPython) ? virtualPython : "python3");
    const registry = command(
      snapshot.root,
      python,
      ["internal/tooling/scripts/generate_source_registry.py", "--check"],
      {
        ...process.env,
        PYTHONPATH: [join(snapshot.root, "apps/ingest/src"), process.env.PYTHONPATH]
          .filter((entry): entry is string => Boolean(entry))
          .join(delimiter),
      },
    );
    if (!registry.ok) {
      issues.push(
        issue(
          "integrity",
          "INTEGRITY_SOURCE_REGISTRY_DRIFT",
          registry.output || "Generated source registry is stale.",
          { file: "internal/infrastructure/generated/source-registry.json" },
        ),
      );
    }
  }

  return gateResult("integrity", issues);
}
