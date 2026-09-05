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
  const catalog = {
    schema_version: "1.0.0",
    implemented_native_families: ["legal_policy", "institutional"],
    native_corpora: [entry],
    retired_corpus_migrations: [],
  };
  const baseline = readNativeRepository();
  const repository: NativeRepository = {
    ...baseline,
    root: directory,
    catalog,
    catalogSource: source("corpora/catalog.yaml", Bun.YAML.stringify(catalog)),
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

function changedJudgmentById(
  bundle: WritDataBundle,
  judgmentId: string,
  change: Record<string, unknown>,
): WritDataBundle {
  return rehash({
    ...bundle,
    recordJudgments: bundle.recordJudgments.map((judgment) =>
      judgment.judgmentId === judgmentId
        ? (Object.fromEntries(
            Object.entries({ ...judgment, ...change }).filter(([, value]) => value !== undefined),
          ) as unknown as WritDataBundle["recordJudgments"][number])
        : judgment,
    ),
  });
}

function replaceRequired(content: string, before: string, after: string): string {
  if (!content.includes(before)) throw new Error(`Expected source text: ${before}`);
  return content.replace(before, after);
}

function changedJudgmentEverywhere(
  bundle: WritDataBundle,
  judgmentId: string,
  change: {
    readonly compiled: Record<string, unknown>;
    readonly source: (content: string) => string;
    readonly projected?: Record<string, unknown>;
  },
): WritDataBundle {
  const original = bundle.recordJudgments.find((judgment) => judgment.judgmentId === judgmentId);
  if (!original) throw new Error(`Missing judgment ${judgmentId}`);
  const fragment = change.source(original.storedSource.content);
  const compiled = Object.fromEntries(
    Object.entries({ ...original.compiledJudgment, ...change.compiled }).filter(
      ([, value]) => value !== undefined,
    ),
  );
  return rehash({
    ...bundle,
    resources: bundle.resources.map((resource) => {
      if (resource.path !== original.storedSource.path) return resource;
      const content = replaceRequired(resource.content, original.storedSource.content, fragment);
      return { ...resource, content, sha256: rawHash(content) };
    }),
    recordJudgments: bundle.recordJudgments.map((judgment) =>
      judgment.judgmentId === judgmentId
        ? ({
            ...judgment,
            ...change.projected,
            compiledJudgment: compiled,
            storedSource: {
              ...judgment.storedSource,
              content: fragment,
              sha256: rawHash(fragment),
            },
          } as WritDataBundle["recordJudgments"][number])
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

function changedFirstRecord(
  bundle: WritDataBundle,
  change: Record<string, unknown>,
): WritDataBundle {
  return rehash({
    ...bundle,
    records: bundle.records.map((record, index) =>
      index === 0 ? ({ ...record, ...change } as typeof record) : record,
    ),
  });
}

function changedFirstLink(bundle: WritDataBundle, change: Record<string, unknown>): WritDataBundle {
  return rehash({
    ...bundle,
    recordLinks: bundle.recordLinks.map((link, index) =>
      index === 0 ? ({ ...link, ...change } as typeof link) : link,
    ),
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
        /compiled judgment disagrees with stored judgment fragment/,
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
      expect(() => validateWritDataBundle(downgraded)).toThrow(/invalid stored judgment fragment/);
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
      const composedFragment = first.storedSource.content.replace(input.artifactPath, composedPath);
      const mismatchedProjection = changedJudgment(bundle, {
        compiledJudgment: {
          ...first.compiledJudgment,
          review_artifact: { path: decomposedPath, content_hash: input.contentHash },
        },
        storedSource: {
          ...first.storedSource,
          content: composedFragment,
          sha256: rawHash(composedFragment),
        },
      });
      const mismatched = replaceWholeFragment(
        mismatchedProjection,
        first.storedSource.path,
        first.storedSource.content,
        composedFragment,
      );
      expect(composedPath).not.toBe(decomposedPath);
      expect(composedPath.normalize("NFD")).toBe(decomposedPath);
      expect(mismatched.recordJudgments[0]!.reviewArtifact).toEqual(first.reviewArtifact);
      expect(() => validateWritDataBundle(mismatched)).toThrow(
        /compiled judgment disagrees with stored judgment fragment/,
      );

      const exactCompiled = Object.fromEntries(
        Object.entries({
          ...first.compiledJudgment,
          review_artifact: Object.fromEntries(
            Object.entries({ path: composedPath, content_hash: input.contentHash }).reverse(),
          ),
        }).reverse(),
      );
      const exactProjection = changedJudgment(bundle, {
        compiledJudgment: exactCompiled,
        storedSource: {
          ...first.storedSource,
          content: composedFragment,
          sha256: rawHash(composedFragment),
        },
      });
      const exact = replaceWholeFragment(
        exactProjection,
        first.storedSource.path,
        first.storedSource.content,
        composedFragment,
      );
      expect(() => validateWritDataBundle(exact)).not.toThrow();
    } finally {
      input.cleanup();
    }
  });

  test("compares exact Unicode spelling in the grammar-supported reviewer identity", () => {
    const input = fixture();
    try {
      const bundle = input.generate();
      const first = bundle.recordJudgments[0]!;
      const composedReviewer = "Reviewer Jos\u00e9";
      const decomposedReviewer = "Reviewer Jose\u0301";
      const composedFragment = first.storedSource.content.replace(
        'reviewer "Synthetic test reviewer label";',
        `reviewer "${composedReviewer}";`,
      );
      const mismatchedProjection = changedJudgment(bundle, {
        compiledJudgment: { ...first.compiledJudgment, reviewer: decomposedReviewer },
        storedSource: {
          ...first.storedSource,
          content: composedFragment,
          sha256: rawHash(composedFragment),
        },
      });
      const mismatched = replaceWholeFragment(
        mismatchedProjection,
        first.storedSource.path,
        first.storedSource.content,
        composedFragment,
      );
      expect(composedReviewer).not.toBe(decomposedReviewer);
      expect(composedReviewer.normalize("NFD")).toBe(decomposedReviewer);
      expect(() => validateWritDataBundle(mismatched)).toThrow(
        /compiled judgment disagrees with stored judgment fragment/,
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
        /compiled judgment disagrees with routed whole judgment resource/,
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
      ).toThrow(/one routed whole resource/);
      const resource = bundle.resources.find((item) => item.path === first.storedSource.path)!;
      expect(() =>
        validateWritDataBundle(rehash({ ...bundle, resources: [...bundle.resources, resource] })),
      ).toThrow(/one routed whole resource/);
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
        /compiled judgment disagrees with routed whole judgment resource/,
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
      expect(() => validateWritDataBundle(contradicted)).toThrow(/duplicate judgment identity/);
    } finally {
      input.cleanup();
    }
  });
});

describe("full native record and link equivalence on portable reload", () => {
  test("rejects independently rehashed record projections, compiled values and retained sources", () => {
    const input = fixture(bytes, false, "0.2");
    try {
      const bundle = input.generate();
      const record = bundle.records[0]!;
      const compiled = record.compiledRecord!;
      const fragment = replaceRequired(
        record.storedSource.content,
        "review_state draft;",
        "review_state approved;",
      );
      const routed = bundle.resources.find(
        (resource) => resource.path === record.storedSource.path,
      )!;
      const routedContent = replaceRequired(routed.content, record.storedSource.content, fragment);
      const evidence = compiled.evidence as readonly Record<string, unknown>[];
      const attacks = [
        changedFirstRecord(bundle, { reviewState: "approved" }),
        changedFirstRecord(bundle, {
          compiledRecord: { ...compiled, review_state: "approved" },
        }),
        changedFirstRecord(bundle, {
          compiledRecord: {
            ...compiled,
            evidence: [{ ...evidence[0], quote: "A substituted exact quote." }],
          },
        }),
        changedFirstRecord(bundle, {
          storedSource: { ...record.storedSource, content: fragment, sha256: rawHash(fragment) },
        }),
        rehash({
          ...bundle,
          resources: bundle.resources.map((resource) =>
            resource.path === routed.path
              ? { ...resource, content: routedContent, sha256: rawHash(routedContent) }
              : resource,
          ),
        }),
      ];
      for (const attacked of attacks) {
        expect(() => validateWritDataBundle(attacked)).toThrow(
          /records disagree with routed native resource projection/,
        );
      }
      expect(() => validateWritDataBundle(bundle)).not.toThrow();
    } finally {
      input.cleanup();
    }
  });

  test("rejects independently rehashed link projections, values and retained sources", () => {
    const input = fixture(bytes, false, "0.2");
    try {
      const bundle = input.generate();
      const link = bundle.recordLinks[0]!;
      const content = replaceRequired(
        link.storedSource.content,
        "review_state: draft",
        "review_state: reviewed",
      );
      const attacks = [
        changedFirstLink(bundle, { reviewState: "reviewed" }),
        changedFirstLink(bundle, { value: { ...link.value, review_state: "reviewed" } }),
        changedFirstLink(bundle, {
          storedSource: { ...link.storedSource, content, sha256: rawHash(content) },
        }),
        rehash({
          ...bundle,
          resources: bundle.resources.map((resource) =>
            resource.path === link.storedSource.path
              ? { ...resource, content, sha256: rawHash(content) }
              : resource,
          ),
        }),
      ];
      for (const attacked of attacks) {
        expect(() => validateWritDataBundle(attacked)).toThrow(
          /record links disagree with routed native resource projection/,
        );
      }
      expect(() => validateWritDataBundle(bundle)).not.toThrow();
    } finally {
      input.cleanup();
    }
  });

  test("rejects a routed source-version change that no longer resolves record evidence", () => {
    const input = fixture(bytes, false, "0.2");
    try {
      const bundle = input.generate();
      const sourcePath = bundle.corpora[0]!.resources.sources[0]!;
      const attacked = rehash({
        ...bundle,
        resources: bundle.resources.map((resource) => {
          if (resource.path !== sourcePath) return resource;
          const content = replaceRequired(
            resource.content,
            "document_version_id synthetic.policy.source.v1;",
            "document_version_id synthetic.policy.source.v2;",
          );
          return { ...resource, content, sha256: rawHash(content) };
        }),
      });
      expect(() => validateWritDataBundle(attacked)).toThrow(/document version/);
      expect(() => validateWritDataBundle(bundle)).not.toThrow();
    } finally {
      input.cleanup();
    }
  });

  test("rejects false source hashes, stale catalog projections and coherent duplicate corpora", () => {
    const input = fixture(bytes, false, "0.2");
    try {
      const bundle = input.generate();
      const falseHash = rehash({
        ...bundle,
        resources: bundle.resources.map((resource, index) =>
          index === 0 ? { ...resource, sha256: `sha256:${"0".repeat(64)}` } : resource,
        ),
      });
      expect(() => validateWritDataBundle(falseHash)).toThrow(/source content hash mismatch/);

      const catalogEntry = bundle.catalog.nativeCorpora[0]!;
      const staleCatalog = rehash({
        ...bundle,
        catalog: {
          ...bundle.catalog,
          nativeCorpora: [{ ...catalogEntry, family: "institutional" }],
        },
      });
      expect(() => validateWritDataBundle(staleCatalog)).toThrow(/catalog projection disagrees/);

      const parsedCatalog = Bun.YAML.parse(bundle.catalog.source.content) as {
        native_corpora: unknown[];
      };
      const catalogContent = Bun.YAML.stringify({
        ...parsedCatalog,
        native_corpora: [...parsedCatalog.native_corpora, parsedCatalog.native_corpora[0]],
      });
      const duplicateCorpus = rehash({
        ...bundle,
        catalog: {
          ...bundle.catalog,
          source: {
            ...bundle.catalog.source,
            content: catalogContent,
            sha256: rawHash(catalogContent),
          },
          nativeCorpora: [...bundle.catalog.nativeCorpora, catalogEntry],
        },
        corpora: [...bundle.corpora, bundle.corpora[0]!],
        records: [...bundle.records, ...bundle.records],
        recordLinks: [...bundle.recordLinks, ...bundle.recordLinks],
      });
      expect(() => validateWritDataBundle(duplicateCorpus)).toThrow(/Duplicate corpus identity/);
      expect(() => validateWritDataBundle(bundle)).not.toThrow();
    } finally {
      input.cleanup();
    }
  });
});

const NIST_SUCCESSOR = "judgment_nist_nvlap_lab_decision_right_v2_bound_review";
const NIST_LINK_SUCCESSOR = "judgment_nist_nvlap_lab_decision_right_v2_supersession_bound_review";
const NIST_PREDECESSOR = "judgment_nist_nvlap_lab_decision_right_v2_human_review";
const NIST_LINK_PREDECESSOR = "judgment_nist_nvlap_lab_decision_right_v2_supersession_human_review";
const nistBundle = generateWritDataBundleForCommit(COMMIT);

function nistJudgment(judgmentId: string) {
  const judgment = nistBundle.recordJudgments.find((item) => item.judgmentId === judgmentId);
  if (!judgment) throw new Error(`Missing NIST judgment ${judgmentId}`);
  return judgment;
}

describe("full native judgment equivalence on portable reload", () => {
  test("rejects Sol's rehashed successor-lineage substitution", () => {
    const original = nistJudgment(NIST_SUCCESSOR);
    const attacked = changedJudgmentById(nistBundle, NIST_SUCCESSOR, {
      compiledJudgment: {
        ...original.compiledJudgment,
        supersedes_judgment_ids: [NIST_LINK_PREDECESSOR],
      },
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/stored judgment fragment/);
  });

  test("rejects Sol's rehashed stored-fragment lineage substitution", () => {
    const original = nistJudgment(NIST_SUCCESSOR);
    const content = replaceRequired(
      original.storedSource.content,
      NIST_PREDECESSOR,
      NIST_LINK_PREDECESSOR,
    );
    const attacked = changedJudgmentById(nistBundle, NIST_SUCCESSOR, {
      storedSource: { ...original.storedSource, content, sha256: rawHash(content) },
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/stored judgment fragment/);
  });

  test("rejects Sol's rehashed accepted-successor status substitution", () => {
    const original = nistJudgment(NIST_SUCCESSOR);
    const attacked = changedJudgmentById(nistBundle, NIST_SUCCESSOR, {
      status: "superseded",
      compiledJudgment: {
        ...original.compiledJudgment,
        status: "superseded",
        superseded_by_judgment_id: NIST_LINK_SUCCESSOR,
      },
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/stored judgment fragment/);
  });

  test("rejects Sol's rehashed superseded-predecessor reactivation", () => {
    const original = nistJudgment(NIST_PREDECESSOR);
    const { superseded_by_judgment_id: _removed, ...compiled } = original.compiledJudgment;
    const attacked = changedJudgmentById(nistBundle, NIST_PREDECESSOR, {
      status: "accepted",
      compiledJudgment: { ...compiled, status: "accepted" },
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/stored judgment fragment/);
  });

  test("rejects Sol's rehashed disposition, rationale and evidence substitution", () => {
    const original = nistJudgment(NIST_SUCCESSOR);
    const attacked = changedJudgmentById(nistBundle, NIST_SUCCESSOR, {
      compiledJudgment: {
        ...original.compiledJudgment,
        value: "withdrawn",
        rationale: "Substituted disposition.",
        evidence_refs: ["nist.about.identity"],
      },
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/stored judgment fragment/);
  });
});

describe("authoritative exported judgment supersession", () => {
  test("rejects reciprocal disagreement and competing successors after all copies agree", () => {
    const attacked = changedJudgmentEverywhere(nistBundle, NIST_LINK_SUCCESSOR, {
      compiled: { supersedes_judgment_ids: [NIST_PREDECESSOR] },
      source: (content) => replaceRequired(content, NIST_LINK_PREDECESSOR, NIST_PREDECESSOR),
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/DISAGREEING_DIRECTION/);
  });

  test("rejects self-supersession after all copies agree", () => {
    const attacked = changedJudgmentEverywhere(nistBundle, NIST_SUCCESSOR, {
      compiled: { supersedes_judgment_ids: [NIST_SUCCESSOR] },
      source: (content) => replaceRequired(content, NIST_PREDECESSOR, NIST_SUCCESSOR),
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/SELF_SUPERSESSION/);
  });

  test("rejects a supersession cycle after all copies agree", () => {
    const attacked = changedJudgmentEverywhere(nistBundle, NIST_SUCCESSOR, {
      compiled: { status: "superseded", superseded_by_judgment_id: NIST_PREDECESSOR },
      projected: { status: "superseded" },
      source: (content) =>
        replaceRequired(
          replaceRequired(content, "status accepted;", "status superseded;"),
          `supersedes_judgment_ids { ${NIST_PREDECESSOR} };`,
          `supersedes_judgment_ids { ${NIST_PREDECESSOR} };\n  superseded_by_judgment_id ${NIST_PREDECESSOR};`,
        ),
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/SUPERSESSION_CYCLE/);
  });

  test("rejects predecessor reactivation inconsistent with its exported successor", () => {
    const attacked = changedJudgmentEverywhere(nistBundle, NIST_PREDECESSOR, {
      compiled: { status: "accepted", superseded_by_judgment_id: undefined },
      projected: { status: "accepted" },
      source: (content) =>
        replaceRequired(
          replaceRequired(content, "status superseded;", "status accepted;"),
          `  superseded_by_judgment_id ${NIST_SUCCESSOR};\n`,
          "",
        ),
    });
    expect(() => validateWritDataBundle(attacked)).toThrow(/DISAGREEING_DIRECTION/);
  });
});
