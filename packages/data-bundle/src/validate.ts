import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import {
  REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
  validateContract,
  validateJudgmentSupersession,
  type SupersessionCandidate,
} from "@writ/domain";
import { compileSource } from "@writ/language";
import { canonicalJson, verifyReviewArtifact } from "@writ/provenance";

import type {
  BundleRecordJudgment,
  BundleResource,
  JsonObject,
  WritDataBundle,
} from "./contract.js";
import { hashCanonical } from "./hashing.js";
import { RECORD_JUDGMENT_CONTRACT, repositoryRoot } from "./repository.js";

const schemaPath = fileURLToPath(
  new URL("../schema/writ-data-bundle.schema.json", import.meta.url),
);
const reviewArtifactSchemaPath = fileURLToPath(
  new URL("../schema/writ-data-bundle-v1.1.schema.json", import.meta.url),
);

type DefaultExport<T> = T extends { default: infer D } ? D : T;
const Ajv2020 = ((_Ajv2020 as { default?: unknown }).default ?? _Ajv2020) as DefaultExport<
  typeof _Ajv2020
>;
const addFormats = ((_addFormats as { default?: unknown }).default ?? _addFormats) as DefaultExport<
  typeof _addFormats
>;

function assertHashes(bundle: WritDataBundle): void {
  for (const section of [
    "catalog",
    "corpora",
    "resources",
    "records",
    "recordLinks",
    "recordJudgments",
  ] as const) {
    const actual = hashCanonical(bundle[section]);
    if (bundle.metadata.sectionHashes[section] !== actual) {
      throw new Error(`${section} hash mismatch`);
    }
  }
  const { bundleHash, ...metadata } = bundle.metadata;
  const actualBundleHash = hashCanonical({
    metadata,
    catalog: bundle.catalog,
    corpora: bundle.corpora,
    resources: bundle.resources,
    records: bundle.records,
    recordLinks: bundle.recordLinks,
    recordJudgments: bundle.recordJudgments,
  });
  if (bundleHash !== actualBundleHash) throw new Error("bundle hash mismatch");
}

function assertPortable(value: unknown, path = "$"): void {
  if (typeof value === "string") {
    if (
      value.includes(repositoryRoot) ||
      value.startsWith("/Users/") ||
      /^[A-Za-z]:[\\/]/.test(value)
    ) {
      throw new Error(`${path} contains a machine-absolute path`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPortable(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) {
      assertPortable(child, `${path}.${childKey}`);
    }
  }
}

export function assertSourceFragments(bundle: WritDataBundle): void {
  for (const record of bundle.records) {
    if (record.storedSource.fragment !== record.recordId) {
      throw new Error(`${record.recordKey} stored-source fragment must equal its record identity`);
    }
  }
  for (const judgment of bundle.recordJudgments) {
    if (judgment.storedSource.fragment !== judgment.judgmentId) {
      throw new Error(
        `${judgment.judgmentKey} stored-source fragment must equal its judgment identity`,
      );
    }
  }
}

interface SupportedJudgmentContract {
  readonly contractId: string;
  readonly dialect: "0.2" | "0.3";
  readonly schemaVersion: "0.2.0" | "0.3.0";
}

function supportedJudgmentContract(judgment: BundleRecordJudgment): SupportedJudgmentContract {
  if (judgment.contractId === RECORD_JUDGMENT_CONTRACT) {
    return { contractId: RECORD_JUDGMENT_CONTRACT, dialect: "0.2", schemaVersion: "0.2.0" };
  }
  if (judgment.contractId === REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID) {
    return {
      contractId: REVIEW_ARTIFACT_JUDGMENT_SCHEMA_ID,
      dialect: "0.3",
      schemaVersion: "0.3.0",
    };
  }
  throw new Error(`${judgment.judgmentKey}: unsupported native judgment contract`);
}

function assertCanonicalJudgmentEquality(
  judgmentKey: string,
  expected: JsonObject,
  actual: JsonObject,
  actualLabel: string,
): void {
  if (canonicalJson(expected) !== canonicalJson(actual)) {
    throw new Error(`${judgmentKey}: compiled judgment disagrees with ${actualLabel}`);
  }
}

/**
 * Reconstruct every exported native judgment from both retained source forms,
 * require full semantic equivalence, and then verify any exported artifact bytes.
 * No repository lookup is performed.
 */
export function assertNativeJudgmentIntegrity(bundle: WritDataBundle): void {
  const artifactHashes = new Map<string, string>();
  const wholeResources = new Map<
    string,
    Array<{ source: BundleResource; compiled: ReturnType<typeof compileSource> }>
  >();
  const resourcesAt = (path: string) => {
    let matches = wholeResources.get(path);
    if (matches === undefined) {
      matches = bundle.resources
        .filter((resource) => resource.path === path)
        .map((source) => ({
          source,
          compiled: compileSource(source.content, { fileName: path }),
        }));
      wholeResources.set(path, matches);
    }
    return matches;
  };
  const judgmentCounts = new Map<string, number>();
  const reconstructedJudgments: SupersessionCandidate[] = [];
  for (const judgment of bundle.recordJudgments) {
    judgmentCounts.set(judgment.judgmentKey, (judgmentCounts.get(judgment.judgmentKey) ?? 0) + 1);
  }
  for (const judgment of bundle.recordJudgments) {
    const compiled = judgment.compiledJudgment;
    const contract = supportedJudgmentContract(judgment);
    const binding = compiled.review_artifact;
    const artifact = judgment.reviewArtifact;
    const sourceCompilation = compileSource(
      `language writ "${contract.dialect}"\npackage exported.judgment version "${contract.schemaVersion}";\n${judgment.storedSource.content}`,
      { fileName: judgment.storedSource.path },
    );
    const sourceResources = resourcesAt(judgment.storedSource.path);
    const wholeDeclarations = sourceResources.flatMap(({ compiled: module }) =>
      module.judgments.filter((item) => item.judgment_id === judgment.judgmentId),
    );
    if (compiled.schema_version !== contract.schemaVersion) {
      throw new Error(`${judgment.judgmentKey}: judgment schema disagrees with its contract`);
    }
    if (contract.schemaVersion === "0.3.0" && bundle.metadata.bundleFormatVersion !== "1.1.0") {
      throw new Error(
        `${judgment.judgmentKey}: judgment schema 0.3.0 requires bundle format 1.1.0`,
      );
    }
    if (judgmentCounts.get(judgment.judgmentKey) !== 1) {
      throw new Error(`${judgment.judgmentKey}: duplicate judgment identity`);
    }
    const validation = validateContract(contract.contractId, compiled);
    if (!validation.valid) {
      throw new Error(
        `${judgment.judgmentKey}: invalid judgment: ${validation.errors.map((issue) => issue.message).join("; ")}`,
      );
    }
    for (const [projected, native] of [
      ["judgmentId", "judgment_id"],
      ["targetKind", "target_kind"],
      ["targetId", "target_id"],
      ["status", "status"],
    ] as const) {
      if (judgment[projected] !== compiled[native]) {
        throw new Error(`${judgment.judgmentKey}: ${projected} disagrees with compiled judgment`);
      }
    }
    if (judgment.judgmentKey !== `${judgment.corpusId}::${judgment.judgmentId}`) {
      throw new Error(`${judgment.judgmentKey}: judgment key disagrees with judgment identity`);
    }
    if (
      judgment.storedSource.language !== "writ" ||
      !sourceCompilation.schemaValid ||
      sourceCompilation.diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
      sourceCompilation.judgments.length !== 1 ||
      sourceCompilation.judgments[0]!.judgment_id !== judgment.judgmentId
    ) {
      throw new Error(`${judgment.judgmentKey}: invalid stored judgment fragment`);
    }
    const fragmentDeclaration = sourceCompilation.judgments[0]! as unknown as JsonObject;
    assertCanonicalJudgmentEquality(
      judgment.judgmentKey,
      compiled,
      fragmentDeclaration,
      "stored judgment fragment",
    );
    const owner = bundle.corpora.find((corpus) => corpus.corpusId === judgment.corpusId);
    const wholeResource = sourceResources[0];
    if (
      !owner?.resources.judgments.includes(judgment.storedSource.path) ||
      sourceResources.length !== 1 ||
      wholeResource?.source.language !== "writ" ||
      wholeResource.source.fragment !== null ||
      !wholeResource.compiled.schemaValid ||
      wholeResource.compiled.diagnostics.some((diagnostic) => diagnostic.severity === "error") ||
      wholeDeclarations.length !== 1
    ) {
      throw new Error(`${judgment.judgmentKey}: judgment requires one routed whole resource`);
    }
    const wholeDeclaration = wholeDeclarations[0]! as unknown as JsonObject;
    assertCanonicalJudgmentEquality(
      judgment.judgmentKey,
      compiled,
      wholeDeclaration,
      "routed whole judgment resource",
    );
    reconstructedJudgments.push(compiled as unknown as SupersessionCandidate);

    if (contract.schemaVersion !== "0.3.0") {
      if (binding !== undefined || artifact !== undefined) {
        throw new Error(`${judgment.judgmentKey}: review binding requires judgment schema 0.3.0`);
      }
      continue;
    }
    if (binding === undefined) {
      if (artifact !== undefined) {
        throw new Error(`${judgment.judgmentKey}: artifact bytes have no declared binding`);
      }
      continue;
    }
    if (artifact === undefined) {
      throw new Error(`${judgment.judgmentKey}: bound review artifact bytes are unavailable`);
    }
    const bytes = Buffer.from(artifact.content, "base64");
    if (artifact.encoding !== "base64" || bytes.toString("base64") !== artifact.content) {
      throw new Error(`${judgment.judgmentKey}: review artifact must use canonical base64`);
    }
    const result = verifyReviewArtifact(binding, bytes);
    if (result.status !== "verified") {
      throw new Error(
        `${judgment.judgmentKey}: ${result.diagnostics.map((item) => `${item.code}: ${item.message}`).join("; ")}`,
      );
    }
    const { path, content_hash: contentHash } = result.binding;
    if (path === judgment.storedSource.path) {
      throw new Error(`${judgment.judgmentKey}: review artifact cannot be its own judgment source`);
    }
    const previousHash = artifactHashes.get(path);
    if (previousHash !== undefined && previousHash !== contentHash) {
      throw new Error(`${judgment.judgmentKey}: contradictory review artifact bytes for ${path}`);
    }
    artifactHashes.set(path, contentHash);
  }
  const supersession = validateJudgmentSupersession(reconstructedJudgments);
  if (!supersession.valid) {
    throw new Error(
      `Invalid exported judgment supersession: ${supersession.issues
        .map((issue) => `${issue.code} [${issue.judgmentId}]: ${issue.message}`)
        .join("; ")}`,
    );
  }
}

export function validateWritDataBundle(bundle: WritDataBundle): void {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const legacySchema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const schema =
    bundle.metadata.bundleFormatVersion === "1.1.0"
      ? JSON.parse(readFileSync(reviewArtifactSchemaPath, "utf8"))
      : legacySchema;
  if (schema !== legacySchema) ajv.addSchema(legacySchema);
  const validate = ajv.compile(schema);
  if (!validate(bundle)) {
    throw new Error(
      `Bundle schema validation failed: ${ajv.errorsText(validate.errors, { separator: "; " })}`,
    );
  }
  assertHashes(bundle);
  for (const forbidden of ["generatedAt", "generated_at", "exportedAt", "exported_at"] as const) {
    if (forbidden in bundle.metadata)
      throw new Error(`metadata.${forbidden} is a generation timestamp`);
  }
  assertSourceFragments(bundle);
  assertNativeJudgmentIntegrity(bundle);
  assertPortable(bundle);
}
