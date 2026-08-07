/**
 * Generate the small, typed corpus projection used by the homepage corpus field.
 *
 * `corpora/catalog.yaml` remains the authority for native corpus identity. Each
 * catalog entry is reconciled with its referenced manifest so presentation can
 * use the real title, family, jurisdiction, status, and instrument/institution
 * identity without teaching the browser how to read the repository.
 *
 * The projection is deterministic: local files only, no clock, network, or
 * randomness. Retired migration entries are deliberately excluded.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type Mapping = Record<string, unknown>;

interface CatalogEntry extends Mapping {
  corpus_id: string;
  family: "legal_policy" | "institutional";
  jurisdiction: string;
  status: "active" | "draft";
  path: string;
  manifest: string;
}

interface CorpusManifest extends Mapping {
  corpus_id: string;
  title: string;
  family: CatalogEntry["family"];
  jurisdiction: string;
  status: CatalogEntry["status"];
  instrument_id?: string;
  root_institution_id?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const catalogPath = "corpora/catalog.yaml";
const outFile = join(here, "..", "lib", "corpus-catalog-data.ts");

function object(value: unknown, label: string): Mapping {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Mapping;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
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

function manifest(value: unknown, path: string): CorpusManifest {
  const item = object(value, path);
  return {
    ...item,
    corpus_id: text(item.corpus_id, `${path}.corpus_id`),
    title: text(item.title, `${path}.title`),
    family: text(item.family, `${path}.family`) as CorpusManifest["family"],
    jurisdiction: text(item.jurisdiction, `${path}.jurisdiction`),
    status: text(item.status, `${path}.status`) as CorpusManifest["status"],
    ...(item.instrument_id
      ? { instrument_id: text(item.instrument_id, `${path}.instrument_id`) }
      : {}),
    ...(item.root_institution_id
      ? { root_institution_id: text(item.root_institution_id, `${path}.root_institution_id`) }
      : {}),
  };
}

function titleCaseSlug(slug: string): string {
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

function issuerLabel(entry: CatalogEntry, record: CorpusManifest): string {
  if (record.family === "institutional") return record.title.replace(/ institutional facts$/, "");
  const segments = entry.path.split("/");
  const issuerSlug = segments.length > 4 ? segments[3] : undefined;
  return issuerSlug ? titleCaseSlug(issuerSlug) : record.jurisdiction;
}

const catalog = object(
  Bun.YAML.parse(readFileSync(join(repoRoot, catalogPath), "utf8")),
  catalogPath,
);
if (!Array.isArray(catalog.native_corpora)) {
  throw new TypeError(`${catalogPath}.native_corpora must be an array`);
}

const projection = catalog.native_corpora.map((value, index) => {
  const entry = catalogEntry(value, index);
  const record = manifest(
    Bun.YAML.parse(readFileSync(join(repoRoot, entry.manifest), "utf8")),
    entry.manifest,
  );

  for (const key of ["corpus_id", "family", "jurisdiction", "status"] as const) {
    if (entry[key] !== record[key]) {
      throw new Error(`${entry.manifest}: ${key} disagrees with ${catalogPath}`);
    }
  }

  return {
    corpusId: entry.corpus_id,
    family: entry.family,
    jurisdiction: entry.jurisdiction,
    status: entry.status,
    title: record.title,
    issuer: issuerLabel(entry, record),
    identity: record.instrument_id ?? record.root_institution_id ?? entry.corpus_id,
    path: entry.path,
  };
});

const body = `// AUTO-GENERATED by apps/web/scripts/embed-corpus-catalog.ts — do not edit by hand.
// Source: corpora/catalog.yaml and the native corpus manifests it references.

export type CatalogCorpusFamily = "legal_policy" | "institutional";
export type CatalogCorpusStatus = "active" | "draft";

export interface CatalogCorpusSummary {
  readonly corpusId: string;
  readonly family: CatalogCorpusFamily;
  readonly jurisdiction: string;
  readonly status: CatalogCorpusStatus;
  readonly title: string;
  readonly issuer: string;
  readonly identity: string;
  readonly path: string;
}

export const CORPUS_CATALOG_SOURCE = ${JSON.stringify(catalogPath)};
// prettier-ignore
export const CORPUS_CATALOG: readonly CatalogCorpusSummary[] = Object.freeze(${JSON.stringify(projection, null, 2)});
`;

writeFileSync(outFile, body);
console.log(`embed-corpus-catalog: wrote ${outFile} (${projection.length} native corpora)`);
