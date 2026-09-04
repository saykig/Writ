import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { validate } from "@writ/domain";
import { sha256Bytes, verifyReviewArtifact } from "@writ/provenance";
import {
  checkManifestChecksum,
  loadRepository,
  repositoryRoot,
  verifySnapshot,
} from "../src/index.js";

const ROOT = repositoryRoot(import.meta.dir);
const CORPUS = "corpora/test/native-legal-policy";
const ARTIFACT = "docs/reviews/synthetic-human-disposition.yaml";
const JUDGMENTS = `${CORPUS}/judgments.writ`;
const BYTES = new TextEncoder().encode(
  "Synthetic human disposition: retain the bounded statement.\n",
);
const HASH = sha256Bytes(BYTES);

function judgmentSource(bindingPath = ARTIFACT, hash = HASH): string {
  return `language writ "0.3"
package test.native_legal_policy.judgments version "0.3.0";
judgment synthetic_bound_review {
  target record synthetic_native_legal_policy_record;
  type review_disposition;
  value "approved";
  rationale "Synthetic accepted fixture; no real human review is claimed.";
  evidence_refs { synthetic.policy.passage };
  reviewer "Synthetic reviewer label";
  status accepted;
  created_at 2026-09-04;
  review_artifact {
    path ${JSON.stringify(bindingPath)};
    content_hash ${JSON.stringify(hash)};
  }
}
`;
}

function workspace(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "writ-binding-verifier-"));
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, CORPUS), { recursive: true });
  cpSync(join(import.meta.dir, "fixtures/native-legal-policy"), join(root, CORPUS), {
    recursive: true,
  });
  mkdirSync(join(root, "docs/reviews"), { recursive: true });
  writeFileSync(join(root, ARTIFACT), BYTES);
  writeFileSync(join(root, JUDGMENTS), judgmentSource());
  writeFileSync(
    join(root, "corpora/catalog.yaml"),
    Bun.YAML.stringify({
      schema_version: "1.0.0",
      implemented_native_families: ["legal_policy", "institutional"],
      native_corpora: [
        {
          corpus_id: "test.native_legal_policy",
          family: "legal_policy",
          jurisdiction: "US",
          status: "draft",
          path: CORPUS,
          manifest: `${CORPUS}/corpus.yaml`,
        },
      ],
      retired_corpus_migrations: [],
    }),
  );
  writeFileSync(
    join(root, CORPUS, "corpus.yaml"),
    Bun.YAML.stringify({
      schema_version: "1.0.0",
      corpus_id: "test.native_legal_policy",
      title: "Synthetic review binding verification",
      family: "legal_policy",
      jurisdiction: "US",
      corpus_version: "0.2.0",
      status: "draft",
      identity_namespace: "test.native_legal_policy",
      migration_aliases: [],
      instrument_id: "synthetic_policy",
      record_contract: {
        kind: "native",
        id: "https://writ.example/schemas/extensions/legal-policy-record.schema.json",
        version: "0.2.0",
      },
      record_counts: { legal_policy_records: 1, record_links: 0, disposition_judgments: 1 },
      review_counts: {
        approved_records: 0,
        superseded_records: 0,
        draft_records: 1,
        approved_record_links: 0,
        draft_record_links: 0,
        accepted_disposition_judgments: 1,
        proposed_disposition_judgments: 0,
        superseded_disposition_judgments: 0,
      },
      unresolved_evidence_count: 0,
      locations: {
        sources: ["sources.writ"],
        passages: ["records.writ"],
        records: ["records.writ"],
        relationships: [],
        judgments: ["judgments.writ"],
        migration: [],
      },
    }),
  );
  execFileSync("git", ["-C", root, "init", "--quiet"], { stdio: "pipe" });
  execFileSync("git", ["-C", root, "add", "--", ARTIFACT], { stdio: "pipe" });
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function verify(root: string) {
  return verifySnapshot(loadRepository(root).snapshot, "all", { runExternalChecks: false });
}

function diagnosticCodes(root: string): string[] {
  return verify(root).gates.flatMap(({ issues }) => issues.map(({ code }) => code));
}

describe("native review-artifact binding across repository verification", () => {
  test("authoritative schema and portable checker agree on difficult path and hash syntax", () => {
    workspace((root) => {
      const judgment = loadRepository(root).snapshot.judgments[0]!.value;
      const candidates = [
        { path: ARTIFACT, content_hash: HASH },
        { path: "docs/\u007f.yaml", content_hash: HASH },
        { path: "docs/\ud800.yaml", content_hash: HASH },
        { path: "docs/\udc00.yaml", content_hash: HASH },
        { path: "docs/📚.yaml", content_hash: HASH },
        { path: "docs/\u2028/../evil", content_hash: HASH },
        { path: "docs/\u2029/../evil", content_hash: HASH },
        { path: ARTIFACT, content_hash: HASH + "\n" },
        { path: "../review.yaml", content_hash: HASH },
        [
          { path: ARTIFACT, content_hash: HASH },
          { path: "docs/other.yaml", content_hash: HASH },
        ],
      ];
      for (const review_artifact of candidates) {
        const pure = verifyReviewArtifact(review_artifact);
        expect(validate("record-judgment", { ...judgment, review_artifact }).valid).toBe(
          pure.status !== "invalid",
        );
      }
    });
  });

  test("all four dimensions accept an exact bound judgment without changing target workflow", () => {
    workspace((root) => {
      const snapshot = loadRepository(root).snapshot;
      expect(snapshot.loadIssues).toEqual([]);
      expect(snapshot.judgments[0]!.value.schema_version).toBe("0.3.0");
      expect(snapshot.judgments[0]!.value.review_artifact).toEqual({
        path: ARTIFACT,
        content_hash: HASH,
      });
      expect(snapshot.records[0]!.value.review_state).toBe("draft");
      expect(verify(root).gates.map(({ gate, passed }) => ({ gate, passed }))).toEqual([
        { gate: "ontology", passed: true },
        { gate: "interoperability", passed: true },
        { gate: "provenance", passed: true },
        { gate: "integrity", passed: true },
      ]);
    });
  });

  test("refreshing ordinary checksums cannot bless substituted review bytes with an unchanged accepted judgment", () => {
    workspace((root) => {
      const beforeJudgments = readFileSync(join(root, JUDGMENTS));
      expect(verify(root).passed).toBe(true);
      writeFileSync(
        join(root, ARTIFACT),
        "Synthetic human disposition: withdraw the bounded statement.\n",
      );
      const inventory = [ARTIFACT, JUDGMENTS];
      const manifestText = inventory
        .map((path) => `${sha256Bytes(readFileSync(join(root, path))).slice(7)}  ${path}\n`)
        .join("");
      expect(checkManifestChecksum({ root, trackedFiles: inventory, manifestText })).toEqual([]);
      expect(readFileSync(join(root, JUDGMENTS))).toEqual(beforeJudgments);
      expect(diagnosticCodes(root)).toEqual(["PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH"]);
      expect(verify(root).passed).toBe(false);
    });
  });

  test("unrelated changes do not invalidate association and wrong matching content is a semantic review responsibility", () => {
    workspace((root) => {
      writeFileSync(join(root, "unrelated.md"), "A harmless surrounding change.");
      expect(verify(root).passed).toBe(true);
      const extraction = new TextEncoder().encode(
        "Synthetic extraction output, with no disposition or authenticated author.",
      );
      writeFileSync(join(root, "docs/reviews/extraction.json"), extraction);
      execFileSync("git", ["-C", root, "add", "--", "docs/reviews/extraction.json"], {
        stdio: "pipe",
      });
      writeFileSync(
        join(root, JUDGMENTS),
        judgmentSource("docs/reviews/extraction.json", sha256Bytes(extraction)),
      );
      expect(verify(root).passed).toBe(true);
    });
  });

  test("matching untracked or ignored artifact bytes cannot pass repository verification", () => {
    workspace((root) => {
      writeFileSync(join(root, ".gitignore"), "dist/\n");
      mkdirSync(join(root, "dist"));
      for (const path of ["docs/reviews/untracked.yaml", "dist/ignored-review.yaml"]) {
        writeFileSync(join(root, path), BYTES);
        writeFileSync(join(root, JUDGMENTS), judgmentSource(path));
        expect(diagnosticCodes(root)).toEqual(["PROVENANCE_REVIEW_ARTIFACT_NOT_TRACKED"]);
        expect(verify(root).passed).toBe(false);
      }
    });
  });

  test("missing, directory, symlink and self-reference artifacts fail repository verification", () => {
    workspace((root) => {
      for (const [path, expected] of [
        ["docs/reviews/missing.yaml", "PROVENANCE_REVIEW_ARTIFACT_NOT_FOUND"],
        ["docs/reviews", "PROVENANCE_REVIEW_ARTIFACT_NOT_REGULAR_FILE"],
        [JUDGMENTS, "PROVENANCE_REVIEW_ARTIFACT_SELF_REFERENCE"],
      ]) {
        writeFileSync(join(root, JUDGMENTS), judgmentSource(path!));
        expect(diagnosticCodes(root)).toContain(expected!);
      }
      symlinkSync(join(root, ARTIFACT), join(root, "docs/reviews/alias.yaml"));
      writeFileSync(join(root, JUDGMENTS), judgmentSource("docs/reviews/alias.yaml"));
      expect(diagnosticCodes(root)).toEqual(["PROVENANCE_REVIEW_ARTIFACT_PATH_ALIAS"]);
    });
  });
});
