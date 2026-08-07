import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CORPUS_CATALOG,
  CORPUS_CATALOG_SOURCE,
  type CatalogCorpusFamily,
  type CatalogCorpusStatus,
} from "../lib/corpus-catalog-data";

const WEB_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(WEB_ROOT, "..", "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("homepage corpus catalog projection", () => {
  test("matches every current native catalog identity and status", () => {
    const catalog = Bun.YAML.parse(
      readFileSync(resolve(REPO_ROOT, CORPUS_CATALOG_SOURCE), "utf8"),
    ) as {
      native_corpora: Array<{
        corpus_id: string;
        family: CatalogCorpusFamily;
        jurisdiction: string;
        status: CatalogCorpusStatus;
        path: string;
      }>;
    };

    expect(CORPUS_CATALOG).toHaveLength(catalog.native_corpora.length);
    expect(
      CORPUS_CATALOG.map(({ corpusId, family, jurisdiction, status, path }) => ({
        corpus_id: corpusId,
        family,
        jurisdiction,
        status,
        path,
      })),
    ).toEqual(
      catalog.native_corpora.map(({ corpus_id, family, jurisdiction, status, path }) => ({
        corpus_id,
        family,
        jurisdiction,
        status,
        path,
      })),
    );
  });

  test("keeps the globe model separate and presents draft institutions truthfully", () => {
    const field = read("components/home/corpus-network.tsx");
    const globe = read("lib/corpus-coverage.ts");

    expect(field).toContain("CORPUS_CATALOG");
    expect(field).not.toContain("CORPUS_COVERAGE");
    expect(globe).toContain("A small presentation configuration for the homepage globe");

    const institutions = CORPUS_CATALOG.filter(({ family }) => family === "institutional");
    expect(institutions).toHaveLength(2);
    expect(institutions.every(({ status }) => status === "draft")).toBe(true);
    expect(field).toContain('corpus.status === "draft"');
  });

  test("is generated deterministically from the catalog and referenced manifests", () => {
    const generator = read("scripts/embed-corpus-catalog.ts");
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(generator).toContain("Bun.YAML.parse");
    expect(generator).toContain("entry.manifest");
    expect(generator).toContain(
      'for (const key of ["corpus_id", "family", "jurisdiction", "status"]',
    );
    expect(pkg.scripts.embed).toContain("embed-corpus-catalog.ts");
    expect(pkg.scripts.build).toContain("embed-corpus-catalog.ts");
  });
});
