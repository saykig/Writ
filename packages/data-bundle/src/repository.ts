import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RAW_COMPATIBILITY_SCHEMAS,
  SCHEMA_IDS,
  isKnownContract,
  validateContract,
} from "@writ/domain";

import type {
  BundleCanonicalIdentity,
  BundleManifestCategory,
  BundleRecordContract,
  BundleSource,
  JsonObject,
} from "./contract.js";

export const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
export const catalogPath = "corpora/catalog.yaml";

export const CATALOG_CONTRACT = "https://writ.example/schemas/core/corpus-catalog.schema.json";
export const MANIFEST_CONTRACT = "https://writ.example/schemas/core/corpus-manifest.schema.json";
export const RECORD_LINK_CONTRACT = "https://writ.example/schemas/core/record-link.schema.json";
export const RECORD_JUDGMENT_CONTRACT =
  "https://writ.example/schemas/analysis/record-judgment.schema.json";
export const REVIEWED_DOCUMENT_CONTRACT =
  "https://writ.example/schemas/compatibility/eu-us-ai-reviewed-v1/reviewed-corpus-document.schema.json";

const contractKey = (contract: BundleRecordContract): string =>
  `${contract.kind}\0${contract.id}\0${contract.version}`;

/**
 * Exact record-contract adapters implemented by the bundle projection.
 *
 * This is a capability list, not schema authority, and it never infers SemVer
 * compatibility. Authoritative contract identity still resolves through
 * `@writ/domain`; the bundle separately declares which exact versions it can
 * project.
 */
const SUPPORTED_RECORD_CONTRACTS = new Set(
  (
    [
      { kind: "native", id: SCHEMA_IDS.record, version: "0.2.0" },
      { kind: "native", id: SCHEMA_IDS["legal-policy-record"], version: "0.2.0" },
      { kind: "native", id: SCHEMA_IDS["institutional-record"], version: "0.2.0" },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS.record.$id),
        version: "0.1.0",
      },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS["legal-policy-record"].$id),
        version: "0.1.0",
      },
      {
        kind: "compatibility",
        id: String(RAW_COMPATIBILITY_SCHEMAS["institutional-record"].$id),
        version: "0.1.0",
      },
      { kind: "compatibility", id: REVIEWED_DOCUMENT_CONTRACT, version: "1.0.0" },
    ] as const satisfies readonly BundleRecordContract[]
  ).map(contractKey),
);

export function assertSupportedRecordContract(contract: BundleRecordContract, label: string): void {
  if (!isKnownContract(contract.id)) {
    throw new Error(`${label}: unknown record contract ${contract.id}`);
  }
  if (!SUPPORTED_RECORD_CONTRACTS.has(contractKey(contract))) {
    throw new Error(
      `${label}: unsupported exact record contract ${contract.kind} ${contract.id} version ${contract.version}`,
    );
  }
}

export const MANIFEST_CATEGORIES: readonly BundleManifestCategory[] = [
  "sources",
  "passages",
  "records",
  "relationships",
  "judgments",
  "migration",
];

export type Mapping = Record<string, unknown>;

export interface CatalogEntry extends Mapping {
  corpus_id: string;
  family: string;
  jurisdiction: string;
  status: string;
  path: string;
  manifest: string;
}

export interface CorpusManifest extends Mapping {
  schema_version: string;
  corpus_id: string;
  title: string;
  family: string;
  jurisdiction: string;
  status: string;
  corpus_version: string;
  record_contract: BundleRecordContract;
  locations: Record<BundleManifestCategory, string[]>;
  record_counts: Mapping;
  review_counts: Mapping;
  unresolved_evidence_count: number;
}

export interface NativeCorpus {
  readonly entry: CatalogEntry;
  readonly manifest: CorpusManifest;
  readonly manifestSource: BundleSource;
  readonly canonicalIdentity: BundleCanonicalIdentity;
  readonly resources: Readonly<Record<BundleManifestCategory, readonly string[]>>;
}

export interface NativeRepository {
  readonly catalog: Mapping;
  readonly catalogSource: BundleSource;
  readonly corpora: readonly NativeCorpus[];
  readonly resources: ReadonlyMap<string, BundleSource>;
}

export function object(value: unknown, label: string): Mapping {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Mapping;
}

export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

export function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  return value;
}

function validate(contractId: string, value: unknown, label: string): void {
  const result = validateContract(contractId, value);
  if (!result.valid) {
    const rendered = result.errors
      .map((issue) => `${issue.instancePath || "/"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${label} failed ${contractId}: ${rendered}`);
  }
}

function parse(path: string, content: string): unknown {
  return path.endsWith(".json") ? JSON.parse(content) : Bun.YAML.parse(content);
}

export function rawHash(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function languageFor(path: string): BundleSource["language"] {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".writ")) return "writ";
  return "yaml";
}

export function source(path: string, content?: string): BundleSource {
  if (isAbsolute(path)) throw new Error(`Bundle source path must be relative: ${path}`);
  const bytes = content ?? readFileSync(join(repositoryRoot, path), "utf8");
  return {
    path,
    fragment: null,
    language: languageFor(path),
    sha256: rawHash(bytes),
    content: bytes,
  };
}

function ensureInsideRepository(absolute: string): string {
  const normalized = realpathSync(absolute);
  const path = relative(repositoryRoot, normalized);
  if (path.startsWith("..") || isAbsolute(path)) {
    throw new Error(`Manifest location escapes the repository: ${absolute}`);
  }
  return path;
}

function structuredFiles(path: string): string[] {
  if (!existsSync(path)) throw new Error(`Manifest location does not exist: ${path}`);
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((name) => structuredFiles(join(path, name)));
}

export function expandLocation(corpusPath: string, location: string): string[] {
  const absolute = resolve(repositoryRoot, corpusPath, location);
  const paths = structuredFiles(absolute)
    .map(ensureInsideRepository)
    .filter((path) => [".json", ".writ", ".yaml", ".yml"].includes(extname(path)))
    .filter((path) => !path.split("/").includes("captures"));
  return [...new Set(paths)].sort();
}

function recordContract(value: unknown, label: string): BundleRecordContract {
  const contract = object(value, label);
  const kind = text(contract.kind, `${label}.kind`);
  if (kind !== "native" && kind !== "compatibility") {
    throw new TypeError(`${label}.kind is unsupported: ${kind}`);
  }
  return {
    kind,
    id: text(contract.id, `${label}.id`),
    version: text(contract.version, `${label}.version`),
  };
}

function catalogEntry(value: unknown, index: number): CatalogEntry {
  const entry = object(value, `native_corpora[${index}]`);
  return {
    ...entry,
    corpus_id: text(entry.corpus_id, `native_corpora[${index}].corpus_id`),
    family: text(entry.family, `native_corpora[${index}].family`),
    jurisdiction: text(entry.jurisdiction, `native_corpora[${index}].jurisdiction`),
    status: text(entry.status, `native_corpora[${index}].status`),
    path: text(entry.path, `native_corpora[${index}].path`),
    manifest: text(entry.manifest, `native_corpora[${index}].manifest`),
  };
}

function corpusManifest(value: unknown, path: string): CorpusManifest {
  const manifest = object(value, path);
  const locations = object(manifest.locations, `${path}.locations`);
  return {
    ...manifest,
    schema_version: text(manifest.schema_version, `${path}.schema_version`),
    corpus_id: text(manifest.corpus_id, `${path}.corpus_id`),
    title: text(manifest.title, `${path}.title`),
    family: text(manifest.family, `${path}.family`),
    jurisdiction: text(manifest.jurisdiction, `${path}.jurisdiction`),
    status: text(manifest.status, `${path}.status`),
    corpus_version: text(manifest.corpus_version, `${path}.corpus_version`),
    record_contract: recordContract(manifest.record_contract, `${path}.record_contract`),
    locations: Object.fromEntries(
      MANIFEST_CATEGORIES.map((category) => [
        category,
        strings(locations[category], `${path}.locations.${category}`),
      ]),
    ) as Record<BundleManifestCategory, string[]>,
    record_counts: object(manifest.record_counts, `${path}.record_counts`),
    review_counts: object(manifest.review_counts, `${path}.review_counts`),
    unresolved_evidence_count: Number(manifest.unresolved_evidence_count),
  };
}

function canonicalIdentity(manifest: CorpusManifest, path: string): BundleCanonicalIdentity {
  const candidates: BundleCanonicalIdentity[] = [];
  if (typeof manifest.instrument_id === "string") {
    candidates.push({ kind: "instrument", instrumentId: manifest.instrument_id });
  }
  if (typeof manifest.instrument_series_id === "string") {
    candidates.push({
      kind: "instrument_series",
      instrumentSeriesId: manifest.instrument_series_id,
    });
  }
  if (typeof manifest.publication_id === "string") {
    candidates.push({ kind: "publication", publicationId: manifest.publication_id });
  }
  if (typeof manifest.dataset_collection_id === "string") {
    candidates.push({
      kind: "dataset_collection",
      datasetCollectionId: manifest.dataset_collection_id,
    });
  }
  if (typeof manifest.root_institution_id === "string") {
    candidates.push({ kind: "root_institution", rootInstitutionId: manifest.root_institution_id });
  }
  if (candidates.length !== 1) {
    throw new Error(`${path} must declare exactly one canonical corpus identity`);
  }
  return candidates[0]!;
}

export function readNativeRepository(): NativeRepository {
  const catalogSource = source(catalogPath);
  const catalog = object(parse(catalogPath, catalogSource.content), catalogPath);
  validate(CATALOG_CONTRACT, catalog, catalogPath);
  if (!Array.isArray(catalog.native_corpora)) {
    throw new TypeError(`${catalogPath}.native_corpora must be an array`);
  }

  const resourceMap = new Map<string, BundleSource>();
  const corpora = catalog.native_corpora.map((value, index): NativeCorpus => {
    const entry = catalogEntry(value, index);
    const manifestSource = source(entry.manifest);
    const manifest = corpusManifest(parse(entry.manifest, manifestSource.content), entry.manifest);
    validate(MANIFEST_CONTRACT, manifest, entry.manifest);
    assertSupportedRecordContract(manifest.record_contract, entry.manifest);
    for (const key of ["corpus_id", "family", "jurisdiction", "status"] as const) {
      if (entry[key] !== manifest[key]) {
        throw new Error(`${entry.manifest}: ${key} disagrees with ${catalogPath}`);
      }
    }

    const resources = Object.fromEntries(
      MANIFEST_CATEGORIES.map((category) => {
        const paths = manifest.locations[category]
          .flatMap((location) => expandLocation(entry.path, location))
          .filter((path) => path !== entry.manifest);
        for (const path of paths) {
          if (!resourceMap.has(path)) resourceMap.set(path, source(path));
        }
        return [category, [...new Set(paths)].sort()];
      }),
    ) as Record<BundleManifestCategory, string[]>;

    return {
      entry,
      manifest,
      manifestSource,
      canonicalIdentity: canonicalIdentity(manifest, entry.manifest),
      resources,
    };
  });

  return {
    catalog,
    catalogSource,
    corpora,
    resources: new Map([...resourceMap].sort(([left], [right]) => left.localeCompare(right))),
  };
}

export function validateAgainstContract(contractId: string, value: unknown, label: string): void {
  validate(contractId, value, label);
}

export function parsedResource(resource: BundleSource): unknown {
  if (resource.language === "writ")
    throw new Error(`${resource.path} must be compiled, not parsed as data`);
  return parse(resource.path, resource.content);
}

export function asJsonObject(value: unknown, label: string): JsonObject {
  return object(value, label);
}
