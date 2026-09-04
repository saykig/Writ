import { describe, expect, test } from "bun:test";

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SCHEMA_IDS } from "@writ/domain";
import { sha256Bytes, verifyReviewArtifact } from "@writ/provenance";

import type { WritDataBundle } from "../src/contract.js";
import { generateWritDataBundleForCommit } from "../src/generate.js";
import { hashCanonical, serializeBundle } from "../src/hashing.js";
import {
  readNativeRepository,
  rawHash,
  repositoryRoot,
  source,
  type NativeRepository,
} from "../src/repository.js";
import { validateWritDataBundle } from "../src/validate.js";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const RECORD_FIXTURE = "internal/verification/writ/test/fixtures/native-legal-policy";
const bytes = new TextEncoder().encode("Synthetic review: retain the bounded assertion.\n");

function fixture(content: Uint8Array = bytes, bound = true, dialect = "0.3") {
  const directory = mkdtempSync(join(tmpdir(), "writ-bundle-binding-"));
  const corpusPath = "corpora/test/native-legal-policy";
  const artifactPath = "docs/reviews/review.bin";
  const judgmentPath = `${corpusPath}/judgments.writ`;
  const recordPath = `${corpusPath}/records.writ`;
  const linkPath = `${corpusPath}/supersession.yaml`;
  mkdirSync(join(directory, corpusPath), { recursive: true });
  mkdirSync(join(directory, "docs/reviews"), { recursive: true });
  cpSync(
    join(repositoryRoot, RECORD_FIXTURE, "sources.writ"),
    join(directory, corpusPath, "sources.writ"),
  );
  const contentHash = sha256Bytes(content);
  writeFileSync(join(directory, artifactPath), content);
  const recordSource = readFileSync(join(repositoryRoot, RECORD_FIXTURE, "records.writ"), "utf8");
  const previousRecord = recordSource
    .slice(recordSource.indexOf("record "))
    .replace("synthetic_native_legal_policy_record", "synthetic_previous_record")
    .replace("review_state draft;", "review_state superseded;");
  writeFileSync(join(directory, recordPath), `${recordSource}\n${previousRecord}`);
  writeFileSync(
    join(directory, linkPath),
    Bun.YAML.stringify({
      schema_version: "1.0.0",
      link_id: "synthetic_supersession_link",
      owning_corpus_id: "test.native_legal_policy",
      source_id: "synthetic_native_legal_policy_record",
      source_kind: "record",
      target_id: "synthetic_previous_record",
      target_kind: "record",
      relation_type: "supersedes",
      basis: "direct",
      evidence_refs: ["synthetic.policy.passage"],
      uncertainties: [],
      provenance: { created_by: "Synthetic export fixture", created_at: "2026-09-04" },
      review_state: "draft",
    }),
  );
  const declaration = (id: string, type: string, target: string) => `judgment ${id} {
  target ${target};
  type ${type};
  value "draft";
  rationale "Synthetic content-association fixture only; no human approval is asserted.";
  evidence_refs { synthetic.policy.passage };
  reviewer "Synthetic test reviewer label";
  status accepted;
  created_at 2026-09-04;
  ${bound ? `review_artifact { path "${artifactPath}"; content_hash "${contentHash}"; }` : ""}
}`;
  writeFileSync(
    join(directory, judgmentPath),
    `language writ "${dialect}"\npackage test.binding version "${dialect}.0";\n${declaration("synthetic_review_one", "review_disposition", "record synthetic_native_legal_policy_record")}\n${declaration("synthetic_review_two", "record_link_disposition", "record_link synthetic_supersession_link")}\n`,
  );
  const entry = {
    corpus_id: "test.native_legal_policy",
    family: "legal_policy",
    jurisdiction: "US",
    status: "draft",
    path: corpusPath,
    manifest: `${corpusPath}/corpus.yaml`,
  };
  const resources = {
    sources: [`${corpusPath}/sources.writ`],
    passages: [recordPath],
    records: [recordPath],
    relationships: [linkPath],
    judgments: [judgmentPath],
    migration: [],
  };
  const manifest = {
    ...entry,
    schema_version: "1.0.0",
    title: "Synthetic review artifact export",
    corpus_version: "0.2.0",
    record_contract: {
      kind: "native" as const,
      id: SCHEMA_IDS["legal-policy-record"],
      version: "0.2.0",
    },
    locations: resources,
    record_counts: { legal_policy_records: 2, record_links: 1, disposition_judgments: 2 },
    review_counts: {},
    unresolved_evidence_count: 0,
  };
  const baseline = readNativeRepository();
  const repository: NativeRepository = {
    ...baseline,
    root: directory,
    corpora: [
      {
        entry,
        manifest,
        manifestSource: source(entry.manifest, Bun.YAML.stringify(manifest)),
        canonicalIdentity: { kind: "instrument", instrumentId: "synthetic_policy" },
        resources,
      },
    ],
    resources: new Map(
      [...new Set(Object.values(resources).flat())].map((path) => [
        path,
        source(path, undefined, directory),
      ]),
    ),
  };
  for (const args of [
    ["init", "-q"],
    ["add", "--all"],
  ]) {
    const result = Bun.spawnSync(["git", ...args], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  }
  return {
    directory,
    artifactPath,
    judgmentPath,
    contentHash,
    generate: () => generateWritDataBundleForCommit(COMMIT, repository),
    cleanup: () => rmSync(directory, { recursive: true, force: true }),
  };
}

/** An attacker may refresh every ordinary outer checksum; native binding still governs bytes. */
function rehash(bundle: WritDataBundle): WritDataBundle {
  const { bundleHash: _oldHash, ...metadata } = bundle.metadata;
  const { metadata: _oldMetadata, ...sections } = bundle;
  const sectionHashes = Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, hashCanonical(value)]),
  ) as WritDataBundle["metadata"]["sectionHashes"];
  const newMetadata = { ...metadata, sectionHashes };
  return {
    metadata: { ...newMetadata, bundleHash: hashCanonical({ metadata: newMetadata, ...sections }) },
    ...sections,
  };
}

function changedJudgment(bundle: WritDataBundle, change: Record<string, unknown>): WritDataBundle {
  return rehash({
    ...bundle,
    recordJudgments: bundle.recordJudgments.map((judgment, index) =>
      index === 0
        ? (Object.fromEntries(
            Object.entries({ ...judgment, ...change }).filter(([, value]) => value !== undefined),
          ) as unknown as WritDataBundle["recordJudgments"][number])
        : judgment,
    ),
  });
}

function replaceWholeFragment(
  bundle: WritDataBundle,
  path: string,
  before: string,
  after: string,
): WritDataBundle {
  return rehash({
    ...bundle,
    resources: bundle.resources.map((resource) => {
      if (resource.path !== path) return resource;
      const content = resource.content.replace(before, after);
      return { ...resource, content, sha256: rawHash(content) };
    }),
  });
}

describe("portable exact review-artifact content association", () => {
  test("keeps ordinary unbound 0.2 judgments in the original 1.0 bundle contract", () => {
    const input = fixture(bytes, false, "0.2");
    try {
      const bundle = input.generate();
      expect(bundle.metadata.bundleFormatVersion).toBe("1.0.0");
      expect(
        bundle.recordJudgments.every((judgment) => judgment.reviewArtifact === undefined),
      ).toBe(true);
      validateWritDataBundle(JSON.parse(serializeBundle(bundle)) as WritDataBundle);
    } finally {
      input.cleanup();
    }
  });

  test("compiles, exports, validates and reloads two distinct judgments sharing exact artifact bytes", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const reloaded = JSON.parse(serializeBundle(bundle)) as WritDataBundle;
      expect(bundle.metadata.bundleFormatVersion).toBe("1.1.0");
      validateWritDataBundle(reloaded);
      expect(reloaded.recordJudgments.map((judgment) => judgment.judgmentId)).toEqual([
        "synthetic_review_one",
        "synthetic_review_two",
      ]);
      expect(
        reloaded.recordJudgments.map((judgment) => [judgment.targetKind, judgment.targetId]),
      ).toEqual([
        ["record", "synthetic_native_legal_policy_record"],
        ["record_link", "synthetic_supersession_link"],
      ]);
      for (const judgment of reloaded.recordJudgments) {
        expect(judgment.compiledJudgment.review_artifact).toEqual({
          path: input.artifactPath,
          content_hash: input.contentHash,
        });
        expect(Buffer.from(judgment.reviewArtifact!.content, "base64")).toEqual(Buffer.from(bytes));
      }
      expect(serializeBundle(input.generate())).toBe(serializeBundle(bundle));
      writeFileSync(join(input.directory, "unrelated.txt"), "Unrelated surrounding changes.\n");
      expect(serializeBundle(input.generate())).toBe(serializeBundle(bundle));
    } finally {
      input.cleanup();
    }
  });

  test("ordinary projection rejects substituted or missing review bytes without changing judgments", () => {
    const input = fixture();
    try {
      const judgmentsBefore = readFileSync(join(input.directory, input.judgmentPath));
      writeFileSync(
        join(input.directory, input.artifactPath),
        "Synthetic review: withdraw the assertion.\n",
      );
      expect(() => input.generate()).toThrow(/PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH/);
      expect(readFileSync(join(input.directory, input.judgmentPath))).toEqual(judgmentsBefore);
      rmSync(join(input.directory, input.artifactPath));
      expect(() => input.generate()).toThrow(/PROVENANCE_REVIEW_ARTIFACT_NOT_FOUND/);
    } finally {
      input.cleanup();
    }
  });

  test("reload rejects changed bytes even after all bundle checksums are refreshed", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const substituted = changedJudgment(bundle, {
        reviewArtifact: {
          encoding: "base64",
          content: Buffer.from("Contradictory disposition.").toString("base64"),
        },
      });
      expect(() => validateWritDataBundle(substituted)).toThrow(
        /PROVENANCE_REVIEW_ARTIFACT_HASH_MISMATCH/,
      );
      const missing = changedJudgment(bundle, { reviewArtifact: undefined });
      expect(() => validateWritDataBundle(missing)).toThrow(/bytes are unavailable/);
      const malformed = changedJudgment(bundle, {
        reviewArtifact: {
          encoding: "base64",
          content: `${bundle.recordJudgments[0]!.reviewArtifact!.content}\n`,
        },
      });
      expect(() => validateWritDataBundle(malformed)).toThrow(/canonical base64/);
    } finally {
      input.cleanup();
    }
  });

  test("absence of a new binding declares no association and never invents artifact bytes", () => {
    const input = fixture(bytes, false);
    try {
      const bundle = input.generate();
      expect(bundle.metadata.bundleFormatVersion).toBe("1.1.0");
      expect(bundle.recordJudgments[0]!.reviewArtifact).toBeUndefined();
      validateWritDataBundle(bundle);
      const orphaned = changedJudgment(bundle, {
        reviewArtifact: { encoding: "base64", content: Buffer.from(bytes).toString("base64") },
      });
      expect(() => validateWritDataBundle(orphaned)).toThrow(/no declared binding/);
    } finally {
      input.cleanup();
    }
  });

  test("rejects format downgrade, contradictory same-path bindings and changed judgment identity", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      expect(() =>
        validateWritDataBundle(
          rehash({ ...bundle, metadata: { ...bundle.metadata, bundleFormatVersion: "1.0.0" } }),
        ),
      ).toThrow();
      expect(() =>
        validateWritDataBundle(changedJudgment(bundle, { judgmentId: "a.different.judgment" })),
      ).toThrow();
      const replacement = new TextEncoder().encode("Another exact artifact version.");
      const first = bundle.recordJudgments[0]!;
      const contradictory = changedJudgment(bundle, {
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: { path: input.artifactPath, content_hash: sha256Bytes(replacement) },
        },
        reviewArtifact: {
          encoding: "base64",
          content: Buffer.from(replacement).toString("base64"),
        },
        storedSource: {
          ...first.storedSource,
          content: first.storedSource.content.replace(input.contentHash, sha256Bytes(replacement)),
        },
      });
      const consistentResource = replaceWholeFragment(
        contradictory,
        first.storedSource.path,
        first.storedSource.content,
        contradictory.recordJudgments[0]!.storedSource.content,
      );
      expect(() => validateWritDataBundle(consistentResource)).toThrow(
        /contradictory review artifact bytes/,
      );
    } finally {
      input.cleanup();
    }
  });

  test("preserves arbitrary and empty exact bytes without claiming semantic review", () => {
    for (const content of [new Uint8Array(), new Uint8Array([0, 255, 128, 13, 10])]) {
      const input = fixture(content);
      try {
        const bundle = input.generate();
        validateWritDataBundle(bundle);
        expect(Buffer.from(bundle.recordJudgments[0]!.reviewArtifact!.content, "base64")).toEqual(
          Buffer.from(content),
        );
        expect(
          verifyReviewArtifact(bundle.recordJudgments[0]!.compiledJudgment.review_artifact).status,
        ).toBe("unavailable");
      } finally {
        input.cleanup();
      }
    }
  });

  test("rejects binding substitution in compiler output when stored judgment source is unchanged", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const first = bundle.recordJudgments[0]!;
      const replacement = new TextEncoder().encode("Materially substituted review disposition.");
      const substituted = changedJudgment(bundle, {
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: {
            path: `${input.artifactPath}.substituted`,
            content_hash: sha256Bytes(replacement),
          },
        },
        reviewArtifact: {
          encoding: "base64",
          content: Buffer.from(replacement).toString("base64"),
        },
      });
      expect(substituted.recordJudgments[0]!.storedSource).toEqual(first.storedSource);
      expect(() => validateWritDataBundle(substituted)).toThrow(
        /binding disagrees with stored judgment source/,
      );
    } finally {
      input.cleanup();
    }
  });

  test("does not let a format downgrade strip a binding still present in native source", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const downgraded = rehash({
        ...bundle,
        metadata: { ...bundle.metadata, bundleFormatVersion: "1.0.0" },
        recordJudgments: bundle.recordJudgments.map(
          ({ reviewArtifact: _artifact, ...judgment }) => {
            const { review_artifact: _binding, ...compiled } = judgment.compiledJudgment;
            return {
              ...judgment,
              contractId: SCHEMA_IDS["record-judgment"],
              compiledJudgment: { ...compiled, schema_version: "0.2.0" },
            };
          },
        ),
      });
      expect(downgraded.recordJudgments.map((judgment) => judgment.storedSource)).toEqual(
        bundle.recordJudgments.map((judgment) => judgment.storedSource),
      );
      expect(() => validateWritDataBundle(downgraded)).toThrow(
        /binding requires judgment schema 0.3.0/,
      );
    } finally {
      input.cleanup();
    }
  });

  test("compares the exact path spelling without Unicode normalization", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const first = bundle.recordJudgments[0]!;
      const composedPath = input.artifactPath.replace("review.bin", "caf\u00e9.yaml");
      const decomposedPath = input.artifactPath.replace("review.bin", "cafe\u0301.yaml");
      const mismatched = changedJudgment(bundle, {
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: { path: decomposedPath, content_hash: input.contentHash },
        },
        storedSource: {
          ...first.storedSource,
          content: first.storedSource.content.replace(input.artifactPath, composedPath),
        },
      });
      expect(composedPath).not.toBe(decomposedPath);
      expect(() => validateWritDataBundle(mismatched)).toThrow(
        /binding disagrees with stored judgment source/,
      );
    } finally {
      input.cleanup();
    }
  });

  test("rejects mutually consistent projected bindings that disagree with the whole native resource", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      validateWritDataBundle(bundle);
      const first = bundle.recordJudgments[0]!;
      const replacement = new TextEncoder().encode("Synthetic withdrawal disposition.\n");
      const newPath = "docs/reviews/another-review.bin";
      const content = first.storedSource.content
        .replace(input.artifactPath, newPath)
        .replace(input.contentHash, sha256Bytes(replacement));
      const substituted = changedJudgment(bundle, {
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: { path: newPath, content_hash: sha256Bytes(replacement) },
        },
        storedSource: { ...first.storedSource, content, sha256: rawHash(content) },
        reviewArtifact: {
          encoding: "base64",
          content: Buffer.from(replacement).toString("base64"),
        },
      });
      expect(substituted.resources).toEqual(bundle.resources);
      expect(() => validateWritDataBundle(substituted)).toThrow(
        /binding disagrees with whole judgment resource/,
      );
      const consistent = replaceWholeFragment(
        substituted,
        first.storedSource.path,
        first.storedSource.content,
        content,
      );
      expect(() => validateWritDataBundle(consistent)).not.toThrow();
      expect(() =>
        validateWritDataBundle(
          rehash({
            ...bundle,
            resources: bundle.resources.filter(
              (resource) => resource.path !== first.storedSource.path,
            ),
          }),
        ),
      ).toThrow(/one routed whole judgment resource/);
      const resource = bundle.resources.find((item) => item.path === first.storedSource.path)!;
      expect(() =>
        validateWritDataBundle(rehash({ ...bundle, resources: [...bundle.resources, resource] })),
      ).toThrow(/one routed whole judgment resource/);
    } finally {
      input.cleanup();
    }
  });

  test("whole native resource prevents a downgrade from stripping every projected binding", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const downgraded = rehash({
        ...bundle,
        metadata: { ...bundle.metadata, bundleFormatVersion: "1.0.0" },
        recordJudgments: bundle.recordJudgments.map(
          ({ reviewArtifact: _artifact, ...judgment }) => {
            const { review_artifact: _binding, ...compiled } = judgment.compiledJudgment;
            const content = judgment.storedSource.content.replace(
              /review_artifact\s*\{[^}]+\}/,
              "",
            );
            return {
              ...judgment,
              contractId: SCHEMA_IDS["record-judgment"],
              compiledJudgment: { ...compiled, schema_version: "0.2.0" },
              storedSource: { ...judgment.storedSource, content, sha256: rawHash(content) },
            };
          },
        ),
      });
      expect(downgraded.resources).toEqual(bundle.resources);
      expect(() => validateWritDataBundle(downgraded)).toThrow(
        /binding requires judgment schema 0.3.0/,
      );
    } finally {
      input.cleanup();
    }
  });

  test("rejects duplicate judgment identities with separately valid contradictory bindings", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const first = bundle.recordJudgments[0]!;
      const replacement = new TextEncoder().encode("Another contradictory disposition.");
      const path = `${input.artifactPath}.other`;
      const contentHash = sha256Bytes(replacement);
      const duplicate = {
        ...first,
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: { path, content_hash: contentHash },
        },
        reviewArtifact: {
          encoding: "base64" as const,
          content: Buffer.from(replacement).toString("base64"),
        },
        storedSource: {
          ...first.storedSource,
          content: first.storedSource.content
            .replace(input.artifactPath, path)
            .replace(input.contentHash, contentHash),
        },
      };
      const contradicted = rehash({
        ...bundle,
        recordJudgments: [...bundle.recordJudgments, duplicate],
      });
      expect(() => validateWritDataBundle(contradicted)).toThrow(
        /duplicate binding-capable judgment identity/,
      );
    } finally {
      input.cleanup();
    }
  });
});
