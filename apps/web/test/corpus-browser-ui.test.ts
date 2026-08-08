import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { projectCorpusRecords } from "../scripts/embed-corpus-records";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");
const projection = projectCorpusRecords();

describe("Corpus inspector contracts", () => {
  test("keeps canonical source and compiled institutional output distinct", () => {
    const legal = Object.values(projection.details).find(
      (detail) => detail.index.family === "legal_policy",
    )!;
    const institutional = Object.values(projection.details).find(
      (detail) => detail.index.family === "institutional",
    )!;

    expect(legal.storedSource.label).toBe("Stored YAML");
    expect(legal.compiledOutput).toBeNull();
    expect(institutional.storedSource.label).toBe("Canonical .writ source");
    expect(institutional.compiledOutput).not.toBeNull();
  });

  test("distinguishes Lab availability without a fallback", () => {
    expect(projection.index.some((record) => record.labRecordId !== null)).toBe(true);
    expect(projection.index.some((record) => record.labRecordId === null)).toBe(true);

    const inspector = read("components/corpus/corpus-inspector.tsx");
    expect(inspector).toContain("Inspect in Lab");
    expect(inspector).toContain("Lab view not yet available");
    expect(inspector).toContain("index.labRecordId");
  });

  test("renders separate supports and identifies unresolved evidence", () => {
    const inspector = read("components/corpus/corpus-inspector.tsx");
    expect(inspector).toContain("detail.evidence.map");
    expect(inspector).toContain("Support {index + 1} of {detail.evidence.length}");
    expect(inspector).toContain("This support is not yet traced.");
  });
});

describe("Corpus detail loading and responsive states", () => {
  test("has explicit loading, 404, error, and invalid-deep-link recovery", () => {
    const browser = read("components/corpus/corpus-browser.tsx");
    const inspector = read("components/corpus/corpus-inspector.tsx");
    const route = read("app/api/corpus/records/[recordKey]/route.ts");

    expect(browser).toContain(
      'type InspectorState = "idle" | "loading" | "ready" | "not_found" | "error"',
    );
    expect(inspector).toContain("Loading canonical record…");
    expect(inspector).toContain("That record is not present in the current corpus.");
    expect(inspector).toContain("Clear selection");
    expect(route).toContain("status: 404");
    expect(route).not.toContain("redirect");
  });

  test("uses a desktop inspector and a mobile-only sheet", () => {
    const browser = read("components/corpus/corpus-browser.tsx");
    expect(browser).toContain('window.matchMedia("(max-width: 1023px)")');
    expect(browser).toContain('aria-label="Record inspector"');
    expect(browser).toContain('side="bottom"');
    expect(browser).toContain("mobileViewport");
    expect(browser).toContain("lg:hidden");
  });

  test("derives evidence choices and states corpus and record status together", () => {
    const browser = read("components/corpus/corpus-browser.tsx");
    const inspector = read("components/corpus/corpus-inspector.tsx");
    expect(browser).toContain('filterValues(familyRecords, "traceState")');
    expect(browser).not.toContain('["fully_traced", "partially_traced", "untraced"]');
    expect(inspector).toContain(
      'index.corpusStatus === "draft" ? "Draft corpus" : "Active corpus"',
    );
    expect(inspector).toContain("{humanizeCorpusValue(index.reviewState)} record");
  });
});
