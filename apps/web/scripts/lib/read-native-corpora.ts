/**
 * One deterministic reader for the native corpus catalog and manifests.
 *
 * Presentation projections may choose different fields, but they must not
 * independently reinterpret corpus identity, family, jurisdiction, status or
 * manifest locations. This module is intentionally local-file-only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Mapping = Record<string, unknown>;
export type NativeCorpusFamily = "legal_policy" | "institutional";
export type NativeCorpusStatus = "active" | "draft";

export interface CatalogEntry extends Mapping {
  corpus_id: string;
  family: NativeCorpusFamily;
  jurisdiction: string;
  status: NativeCorpusStatus;
  path: string;
  manifest: string;
}

export interface CorpusManifest extends Mapping {
  corpus_id: string;
  title: string;
  family: NativeCorpusFamily;
  jurisdiction: string;
  status: NativeCorpusStatus;
  corpus_version: string;
  instrument_id?: string;
  root_institution_id?: string;
  record_counts: Mapping;
  review_counts: Mapping;
  locations: Mapping;
  unresolved_evidence_count: number;
}

export interface NativeCorpus {
  readonly catalogIndex: number;
  readonly entry: CatalogEntry;
  readonly manifest: CorpusManifest;
  readonly manifestText: string;
}

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, "..", "..", "..", "..");
export const catalogPath = "corpora/catalog.yaml";

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

export function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  return value;
}

export function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return Number(value);
}

function catalogEntry(value: unknown, index: number): CatalogEntry {
  const item = object(value, `native_corpora[${index}]`);
  const family = text(item.family, `native_corpora[${index}].family`);
  const status = text(item.status, `native_corpora[${index}].status`);
  if (family !== "legal_policy" && family !== "institutional") {
    throw new TypeError(`Unsupported native family: ${family}`);
  }
  if (status !== "active" && status !== "draft") {
    throw new TypeError(`Unsupported corpus status: ${status}`);
  }
  return {
    ...item,
    corpus_id: text(item.corpus_id, `native_corpora[${index}].corpus_id`),
    family,
    jurisdiction: text(item.jurisdiction, `native_corpora[${index}].jurisdiction`),
    status,
    path: text(item.path, `native_corpora[${index}].path`),
    manifest: text(item.manifest, `native_corpora[${index}].manifest`),
  };
}

function corpusManifest(value: unknown, path: string): CorpusManifest {
  const item = object(value, path);
  const family = text(item.family, `${path}.family`);
  const status = text(item.status, `${path}.status`);
  if (family !== "legal_policy" && family !== "institutional") {
    throw new TypeError(`${path}.family is unsupported: ${family}`);
  }
  if (status !== "active" && status !== "draft") {
    throw new TypeError(`${path}.status is unsupported: ${status}`);
  }
  return {
    ...item,
    corpus_id: text(item.corpus_id, `${path}.corpus_id`),
    title: text(item.title, `${path}.title`),
    family,
    jurisdiction: text(item.jurisdiction, `${path}.jurisdiction`),
    status,
    corpus_version: text(item.corpus_version, `${path}.corpus_version`),
    ...(item.instrument_id
      ? { instrument_id: text(item.instrument_id, `${path}.instrument_id`) }
      : {}),
    ...(item.root_institution_id
      ? { root_institution_id: text(item.root_institution_id, `${path}.root_institution_id`) }
      : {}),
    record_counts: object(item.record_counts, `${path}.record_counts`),
    review_counts: object(item.review_counts, `${path}.review_counts`),
    locations: object(item.locations, `${path}.locations`),
    unresolved_evidence_count: nonNegativeInteger(
      item.unresolved_evidence_count,
      `${path}.unresolved_evidence_count`,
    ),
  };
}

export function readNativeCorpora(): readonly NativeCorpus[] {
  const catalog = object(
    Bun.YAML.parse(readFileSync(join(repoRoot, catalogPath), "utf8")),
    catalogPath,
  );
  if (!Array.isArray(catalog.native_corpora)) {
    throw new TypeError(`${catalogPath}.native_corpora must be an array`);
  }

  return catalog.native_corpora.map((value, catalogIndex) => {
    const entry = catalogEntry(value, catalogIndex);
    const manifestText = readFileSync(join(repoRoot, entry.manifest), "utf8");
    const manifest = corpusManifest(Bun.YAML.parse(manifestText), entry.manifest);

    for (const key of ["corpus_id", "family", "jurisdiction", "status"] as const) {
      if (entry[key] !== manifest[key]) {
        throw new Error(`${entry.manifest}: ${key} disagrees with ${catalogPath}`);
      }
    }

    return { catalogIndex, entry, manifest, manifestText };
  });
}

export function resolveCorpusPath(corpus: NativeCorpus, relativePath: string): string {
  return join(repoRoot, corpus.entry.path, relativePath);
}

export function readCorpusFile(corpus: NativeCorpus, relativePath: string): string {
  return readFileSync(resolveCorpusPath(corpus, relativePath), "utf8");
}

export function titleCaseSlug(slug: string): string {
  const quietWords = new Set(["and", "of", "the"]);
  return slug
    .split("-")
    .map((word, index) => {
      if (quietWords.has(word) && index > 0) return word;
      if (word.length <= 4) return word.toUpperCase();
      return `${word[0]?.toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

export function issuerLabel(corpus: NativeCorpus): string {
  if (corpus.manifest.family === "institutional") {
    return corpus.manifest.title.replace(/ institutional facts$/, "");
  }
  const segments = corpus.entry.path.split("/");
  const issuerSlug = segments.length > 4 ? segments[3] : undefined;
  return issuerSlug ? titleCaseSlug(issuerSlug) : corpus.manifest.jurisdiction;
}
