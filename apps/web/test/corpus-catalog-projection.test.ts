import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

  test("keeps the globe model separate and uses the explicit nine-corpus presentation subset", () => {
    const field = read("components/home/corpus-network.tsx");
    const globe = read("lib/corpus-coverage.ts");

    expect(field).toContain("CORPUS_CATALOG");
    expect(field).not.toContain("CORPUS_COVERAGE");
    expect(globe).toContain("A small presentation configuration for the homepage globe");

    const institutions = CORPUS_CATALOG.filter(({ family }) => family === "institutional");
    expect(institutions).toHaveLength(2);
    expect(institutions.every(({ status }) => status === "draft")).toBe(true);
    const featuredIds = [
      "writ.corpus.legal-policy.eu.european-union.artificial-intelligence-act-2024-1689",
      "writ.corpus.legal-policy.eu.european-commission.gpai-guidelines",
      "writ.corpus.legal-policy.eu.european-commission.gpai-code-of-practice-signatory-notice",
      "eu.institutions.european_commission",
      "writ.corpus.legal-policy.us.nist.ai-risk-management-framework-1-0",
      "writ.corpus.legal-policy.us.nist.generative-ai-profile",
      "writ.corpus.legal-policy.us.office-of-management-and-budget.m-25-21",
      "writ.corpus.legal-policy.us.white-house.americas-ai-action-plan",
      "us.institutions.nist",
    ];
    const excludedIds = [
      "writ.corpus.legal-policy.us.nist.ai-risk-management-framework-playbook",
      "writ.corpus.legal-policy.us.nist.caisi.overview",
      "writ.corpus.legal-policy.us.nist.caisi.guidelines",
      "writ.corpus.legal-policy.us.office-of-management-and-budget.m-25-22",
      "writ.corpus.legal-policy.us.white-house.ai-leadership-fact-sheet-2025-01",
      "writ.corpus.legal-policy.us.white-house.national-ai-policy-framework-fact-sheet-2025-12",
      "us.constitutional_law",
    ];
    expect(featuredIds).toHaveLength(9);
    for (const corpusId of featuredIds) expect(field).toContain(corpusId);
    for (const corpusId of excludedIds) expect(field).not.toContain(corpusId);

    const commission = institutions.find(({ corpusId }) =>
      corpusId.includes("european_commission"),
    );
    const nist = institutions.find(({ corpusId }) => corpusId === "us.institutions.nist");
    expect(commission?.mappedCount).toBe(20);
    expect(nist?.mappedCount).toBe(15);
    expect(commission?.mappedCountKind).toBe("institutional_records");
    expect(nist?.mappedCountKind).toBe("institutional_records");
  });

  test("embeds exact canonical source only for featured corpus inspection", () => {
    const featured = CORPUS_CATALOG.filter(({ rawFiles }) => rawFiles);
    expect(featured).toHaveLength(9);

    for (const corpus of featured) {
      expect(corpus.rawFiles).toHaveLength(2);
      for (const file of corpus.rawFiles ?? []) {
        expect(file.content).toBe(readFileSync(resolve(REPO_ROOT, file.path), "utf8"));
      }
    }

    const institutionalFiles = featured
      .filter(({ family }) => family === "institutional")
      .flatMap(({ rawFiles }) => rawFiles ?? []);
    expect(
      institutionalFiles.some(
        ({ name, language }) => name === "records.writ" && language === "writ",
      ),
    ).toBe(true);
    expect(
      featured.some(({ rawFiles }) => rawFiles?.some(({ name }) => name === "claims.yaml")),
    ).toBe(true);
  });

  test("is generated deterministically from the catalog and referenced manifests", () => {
    const generator = read("scripts/embed-corpus-catalog.ts");
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

    expect(generator).toContain("Bun.YAML.parse");
    expect(generator).toContain("entry.manifest");
    expect(generator).toContain("record_counts");
    expect(generator).toContain('readFileSync(join(repoRoot, primaryRecordPath), "utf8")');
    expect(generator).toContain(
      'for (const key of ["corpus_id", "family", "jurisdiction", "status"]',
    );
    expect(pkg.scripts.embed).toContain("embed-corpus-catalog.ts");
    expect(pkg.scripts.build).toContain("embed-corpus-catalog.ts");
  });

  test("check mode detects drift without mutating the generated projection", () => {
    const generated = resolve(WEB_ROOT, "lib/corpus-catalog-data.ts");
    const before = createHash("sha256").update(readFileSync(generated)).digest("hex");
    const result = Bun.spawnSync([process.execPath, "scripts/embed-corpus-catalog.ts", "--check"], {
      cwd: WEB_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    const after = createHash("sha256").update(readFileSync(generated)).digest("hex");
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(after).toBe(before);
  });
});
