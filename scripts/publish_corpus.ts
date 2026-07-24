#!/usr/bin/env bun
// Publish Phase 1A architecture artifacts to the append-only Neon corpus store.
//
// Default mode is an offline dry run. `--publish` requires DATABASE_URL and
// applies migrations before importing the generated registry projection.
import { readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRepositories } from "../apps/api/src/db/repositories/index.js";
import {
  prepareCorpusArtifact,
  type CorpusArtifactInput,
  type CorpusObjectKind,
} from "../apps/api/src/db/repositories/corpus.js";
import type { RegistryDocument } from "../apps/api/src/db/repositories/sourceRegistry.js";
import { closeSql, getSql } from "../apps/api/src/db/client.js";
import { applyMigrations } from "../apps/api/src/db/migrate.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

interface Options {
  publish: boolean;
  sourceId: string;
  summitSlug: string;
}

function parseOptions(argv: string[]): Options {
  const publish = argv.includes("--publish");
  const valueAfter = (flag: string): string => {
    const index = argv.indexOf(flag);
    const value = index >= 0 ? argv[index + 1] : undefined;
    if (!value || value.startsWith("--")) {
      throw new Error(`${flag} is required`);
    }
    return value;
  };
  return {
    publish,
    sourceId: valueAfter("--source-id"),
    summitSlug: valueAfter("--summit-slug"),
  };
}

function artifact(
  options: Options,
  relativePath: string,
  logicalSuffix: string,
  objectKind: CorpusObjectKind,
  mediaType: string,
  schemaVersion?: string,
): CorpusArtifactInput {
  return {
    logicalId: `corpus.${options.sourceId}.${logicalSuffix}`,
    sourceId: options.sourceId,
    objectKind,
    content: readFileSync(resolve(ROOT, relativePath)),
    mediaType,
    schemaVersion,
    summitSlug:
      objectKind === "source_manifest" || objectKind === "ingestion_report"
        ? options.summitSlug
        : undefined,
    provenance: {
      phase: "1A",
      repository_path: relativePath,
      live_fetch_authorized: false,
      contains_normalized_records: false,
    },
  };
}

function phase1aArtifacts(options: Options): CorpusArtifactInput[] {
  const schemaFiles = readdirSync(resolve(ROOT, "schemas"))
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
  return [
    artifact(
      options,
      "config/source_registry.yml",
      "source_registry.canonical",
      "source_registry",
      "application/yaml",
      "1.0.0",
    ),
    artifact(
      options,
      "data/source-registry.json",
      "source_registry.compatibility",
      "source_registry",
      "application/json",
      "1.0.0",
    ),
    ...schemaFiles.map((name) =>
      artifact(
        options,
        `schemas/${name}`,
        `schema.${basename(name, ".schema.json")}`,
        "schema",
        "application/schema+json",
        "1.0.0",
      ),
    ),
    artifact(
      options,
      `data/manifests/g20/${options.summitSlug}/source-manifest.json`,
      `manifest.${options.summitSlug}`,
      "source_manifest",
      "application/json",
      "1.0.0",
    ),
    artifact(
      options,
      `data/manifests/g20/${options.summitSlug}/ingestion-report.md`,
      `ingestion_report.${options.summitSlug}`,
      "ingestion_report",
      "text/markdown",
      "1.0.0",
    ),
  ];
}

const options = parseOptions(process.argv.slice(2));
const inputs = phase1aArtifacts(options);
const prepared = inputs.map(prepareCorpusArtifact);

if (!options.publish) {
  console.log(
    JSON.stringify(
      {
        mode: "dry_run",
        source_id: options.sourceId,
        artifact_count: prepared.length,
        artifacts: prepared.map((item) => ({
          logical_id: item.logicalId,
          object_kind: item.objectKind,
          sha256: item.artifactSha256,
          byte_size: item.byteSize,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const sql = getSql();
try {
  const migrations = await applyMigrations(sql);
  const repositories = createRepositories(sql);
  const registry = JSON.parse(
    readFileSync(resolve(ROOT, "data/source-registry.json"), "utf8"),
  ) as RegistryDocument;
  if (!registry.entries.some((entry) => entry.id === options.sourceId)) {
    throw new Error(`unregistered source: ${options.sourceId}`);
  }
  const registrySummary = await repositories.sourceRegistry.importRegistry(registry);
  const results = [];
  for (const input of inputs) {
    results.push(await repositories.corpus.publish(input));
  }
  console.log(
    JSON.stringify(
      {
        mode: "published",
        source_id: options.sourceId,
        migrations_applied: migrations,
        registry: registrySummary,
        artifact_count: results.length,
        created: results.filter((item) => item.created).length,
        unchanged: results.filter((item) => !item.created).length,
        artifacts: results.map((item) => ({
          logical_id: item.logicalId,
          object_id: item.objectId,
          object_kind: item.objectKind,
          sha256: item.artifactSha256,
          byte_size: item.byteSize,
          created: item.created,
          supersedes_object_id: item.supersedesObjectId,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await closeSql();
}
