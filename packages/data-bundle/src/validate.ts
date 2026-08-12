import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";

import type { WritDataBundle } from "./contract.js";
import { hashCanonical } from "./hashing.js";
import { repositoryRoot } from "./repository.js";

const schemaPath = fileURLToPath(
  new URL("../schema/writ-data-bundle.schema.json", import.meta.url),
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

export function validateWritDataBundle(bundle: WritDataBundle): void {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
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
  assertPortable(bundle);
}
