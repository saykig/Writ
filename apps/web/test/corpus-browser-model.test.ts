import { describe, expect, test } from "bun:test";

import {
  EMPTY_CORPUS_FILTERS,
  filterCorpusRecords,
  filterValues,
  groupCorpusRecords,
  type CorpusBrowserFilters,
} from "../lib/corpus-browser-model";
import { CORPUS_RECORD_INDEX } from "../lib/corpus-record-index-data";

function withFilters(changes: Partial<CorpusBrowserFilters>): CorpusBrowserFilters {
  return { ...EMPTY_CORPUS_FILTERS, ...changes };
}

describe("Corpus browser model", () => {
  test("searches readable identity, source and interpretation text", () => {
    expect(
      filterCorpusRecords(CORPUS_RECORD_INDEX, withFilters({ search: "Article 53(1)(a)" })),
    ).toHaveLength(2);
    expect(
      filterCorpusRecords(
        CORPUS_RECORD_INDEX,
        withFilters({ search: "organizational placement" }),
      ).every((record) => record.family === "institutional"),
    ).toBe(true);
  });

  test("filters jurisdiction and family independently", () => {
    expect(
      filterCorpusRecords(CORPUS_RECORD_INDEX, withFilters({ jurisdiction: "EU" })),
    ).toHaveLength(35);
    expect(
      filterCorpusRecords(CORPUS_RECORD_INDEX, withFilters({ family: "legal_policy" })),
    ).toHaveLength(32);
    expect(
      filterCorpusRecords(CORPUS_RECORD_INDEX, withFilters({ family: "institutional" })),
    ).toHaveLength(34);
  });

  test("applies family-specific filters without inventing cross-family fields", () => {
    const binding = filterCorpusRecords(
      CORPUS_RECORD_INDEX,
      withFilters({ family: "legal_policy", legalForce: "binding" }),
    );
    expect(binding.length).toBeGreaterThan(0);
    expect(
      binding.every(
        (record) => record.family === "legal_policy" && record.legalForce === "binding",
      ),
    ).toBe(true);

    const mandates = filterCorpusRecords(
      CORPUS_RECORD_INDEX,
      withFilters({ family: "institutional", factType: "mandate" }),
    );
    expect(mandates.length).toBeGreaterThan(0);
    expect(mandates.every((record) => record.factType === "mandate")).toBe(true);
  });

  test("combines search, jurisdiction and evidence state and supports empty results", () => {
    const combined = filterCorpusRecords(
      CORPUS_RECORD_INDEX,
      withFilters({ search: "guidelines", jurisdiction: "EU", evidence: "untraced" }),
    );
    expect(combined).toHaveLength(3);
    expect(
      filterCorpusRecords(CORPUS_RECORD_INDEX, withFilters({ search: "no such record" })),
    ).toHaveLength(0);
  });

  test("reset values restore the full projection", () => {
    expect(filterCorpusRecords(CORPUS_RECORD_INDEX, EMPTY_CORPUS_FILTERS)).toHaveLength(66);
  });

  test("groups records by canonical corpus with filtered and total counts", () => {
    const visible = filterCorpusRecords(
      CORPUS_RECORD_INDEX,
      withFilters({ family: "institutional", jurisdiction: "US" }),
    );
    const groups = groupCorpusRecords(visible, CORPUS_RECORD_INDEX);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.corpusId).toBe("us.institutions.nist");
    expect(groups[0]?.records).toHaveLength(14);
    expect(groups[0]?.totalCount).toBe(14);
  });

  test("derives evidence options from the current projected records", () => {
    expect(filterValues(CORPUS_RECORD_INDEX, "traceState")).toEqual(["fully_traced", "untraced"]);
  });
});
