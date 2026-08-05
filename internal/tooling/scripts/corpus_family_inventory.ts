#!/usr/bin/env bun

/** Deterministic preservation inventory for the corpus-family migration. */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OLD_ROOTS = [
  "corpora/jurisdictions/eu/ai-governance",
  "corpora/jurisdictions/us/ai-governance",
] as const;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Document = Record<string, unknown>;

function yaml(path: string): Document {
  return Bun.YAML.parse(readFileSync(join(ROOT, path), "utf8")) as Document;
}

function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function treeDigest(path: string): { files: number; sha256: string } {
  const absolute = join(ROOT, path);
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const child = join(directory, name);
      if (statSync(child).isDirectory()) walk(child);
      else files.push(child);
    }
  };
  walk(absolute);
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(relative(absolute, file).replaceAll("\\", "/"));
    digest.update("\0");
    digest.update(readFileSync(file));
    digest.update("\0");
  }
  return { files: files.length, sha256: digest.digest("hex") };
}

function stable(value: unknown): Json {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Document)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    ) as { [key: string]: Json };
  }
  return value as Json;
}

function byId(records: unknown[], kind: string, sourcePath: string): Document[] {
  return records.map((raw) => {
    const record = structuredClone(raw) as Document;
    if (kind === "claims") {
      // Family/corpus coordinates are structural migration metadata. Every other
      // field is compared exactly before and after the move.
      delete record.family;
      delete record.corpus_id;
    }
    return { kind, source_path: sourcePath, ...record };
  });
}

function oldCorpusRecords(base: string): Document[] {
  const paths = [
    ["sources", "sources/sources.yaml", "sources"],
    ["passages", "passages/passages.yaml", "passages"],
    ["unresolved", "passages/unresolved.yaml", "unresolved"],
    ["entities", "records/entities.yaml", "entities"],
    ["claims", "records/claims.yaml", "claims"],
    ["relationships", "records/relationships.yaml", "relationships"],
    ["reviews", "reviews/parent-annotations.yaml", "reviews"],
  ] as const;
  return paths.flatMap(([kind, suffix, key]) => {
    const path = `${base}/${suffix}`;
    const value = yaml(path)[key];
    return byId(Array.isArray(value) ? value : [], kind, path);
  });
}

function writInventory(path: string): Document {
  const text = readFileSync(join(ROOT, path), "utf8");
  return {
    path,
    sha256: hashBytes(new TextEncoder().encode(text)),
    record_ids: [...text.matchAll(/^record\s+([^\s:]+)/gm)].map((match) => match[1]!),
    corpus_ids: [...text.matchAll(/^\s*corpus\s+([^;]+);/gm)].map((match) => match[1]!),
    review_states: [...text.matchAll(/^\s*review_state\s+(\w+);/gm)].map(
      (match) => match[1]!,
    ),
    created_by: [...text.matchAll(/created_by\s+"([^"]+)"/g)].map((match) => match[1]!),
    hashes: [...text.matchAll(/sha256:[0-9a-f]{64}/g)].map((match) => match[0]),
  };
}

async function main(): Promise<void> {
  if (!OLD_ROOTS.every((path) => existsSync(join(ROOT, path)))) {
    throw new Error("pre-migration subject-based corpus roots are not present");
  }
  const records = OLD_ROOTS.flatMap(oldCorpusRecords);
  const identity = records
    .map((record) => ({
      kind: record.kind,
      machine_id: record.machine_id ?? null,
      legacy_refs: record.legacy_refs ?? [],
      verification_status: record.verification_status ?? null,
      review_status: record.review_status ?? record.review_decision ?? null,
      hashes: Object.fromEntries(
        Object.entries(record).filter(([key]) => key.toLowerCase().includes("hash")),
      ),
    }))
    .sort((left, right) =>
      `${left.kind}:${left.machine_id}`.localeCompare(`${right.kind}:${right.machine_id}`),
    );
  const inventory = stable({
    inventory_version: "1.0.0",
    base_sha: "296f79f91f3d5d64b9b7f8f6b6866df881e7e868",
    retired_corpus_ids: ["writ.corpus.eu.ai-governance", "writ.corpus.us.ai-governance"],
    object_counts: Object.fromEntries(
      [...new Set(records.map((record) => String(record.kind)))].sort().map((kind) => [
        kind,
        records.filter((record) => record.kind === kind).length,
      ]),
    ),
    identities: identity,
    accepted_claims: records
      .filter((record) => record.kind === "claims")
      .map(({ source_path: _sourcePath, kind: _kind, ...record }) => record)
      .sort((left, right) =>
        String((left.legacy_refs as unknown[] | undefined)?.[0] ?? "").localeCompare(
          String((right.legacy_refs as unknown[] | undefined)?.[0] ?? ""),
        ),
      ),
    nist: writInventory("corpora/us/institutions/nist/records.writ"),
    constitutional: [
      writInventory("corpora/us/constitutional-law/federal/amendment-xiii.writ"),
      writInventory(
        "corpora/us/constitutional-law/states/al/type-article-num-1-label-article-1-name-declaration-of-rights.writ",
      ),
      writInventory("corpora/us/constitutional-law/territories/pr/art-culo-iii.writ"),
    ],
    protected_trees: {
      archive_pilot: treeDigest("archive/pilots/eu-us-ai-evaluation-v1"),
      g7: treeDigest("archive/compatibility/g7/2025-ai-sme"),
      g20: treeDigest("archive/compatibility/g20/2024-rio"),
    },
    reviewed_yaml_sha256: hashBytes(
      readFileSync(
        join(
          ROOT,
          "archive/pilots/eu-us-ai-evaluation-v1/original/annotations/human-reviewed.yaml",
        ),
      ),
    ),
  });
  const rendered = `${JSON.stringify(inventory, null, 2)}\n`;
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error("--output requires a repository-relative path");
    await Bun.write(join(ROOT, output), rendered);
  } else {
    process.stdout.write(rendered);
  }
}

await main();
