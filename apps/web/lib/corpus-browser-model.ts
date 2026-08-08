import type { CorpusFamily, CorpusRecordIndex, CorpusTraceState } from "./corpus-record-types";

export interface CorpusBrowserFilters {
  readonly search: string;
  readonly jurisdiction: "all" | "EU" | "US";
  readonly family: "all" | CorpusFamily;
  readonly evidence: "any" | CorpusTraceState;
  readonly legalForce: string;
  readonly adoption: string;
  readonly applicability: string;
  readonly enforcement: string;
  readonly factType: string;
}

export interface CorpusGroup {
  readonly corpusId: string;
  readonly corpusTitle: string;
  readonly corpusStatus: CorpusRecordIndex["corpusStatus"];
  readonly family: CorpusFamily;
  readonly jurisdiction: "EU" | "US";
  readonly corpusIndex: number;
  readonly totalCount: number;
  readonly records: readonly CorpusRecordIndex[];
}

export const EMPTY_CORPUS_FILTERS: CorpusBrowserFilters = {
  search: "",
  jurisdiction: "all",
  family: "all",
  evidence: "any",
  legalForce: "any",
  adoption: "any",
  applicability: "any",
  enforcement: "any",
  factType: "any",
};

export function normalizeCorpusSearch(value: string): string {
  return value.normalize("NFKD").trim().toLocaleLowerCase("en");
}

export function filterCorpusRecords(
  records: readonly CorpusRecordIndex[],
  filters: CorpusBrowserFilters,
): readonly CorpusRecordIndex[] {
  const search = normalizeCorpusSearch(filters.search);
  return records.filter((record) => {
    if (filters.jurisdiction !== "all" && record.jurisdiction !== filters.jurisdiction)
      return false;
    if (filters.family !== "all" && record.family !== filters.family) return false;
    if (filters.evidence !== "any" && record.traceState !== filters.evidence) return false;
    if (filters.family === "legal_policy") {
      if (filters.legalForce !== "any" && record.legalForce !== filters.legalForce) return false;
      if (filters.adoption !== "any" && record.adoption !== filters.adoption) return false;
      if (filters.applicability !== "any" && record.applicability !== filters.applicability) {
        return false;
      }
      if (filters.enforcement !== "any" && record.enforcement !== filters.enforcement) return false;
    }
    if (filters.family === "institutional" && filters.factType !== "any") {
      if (record.factType !== filters.factType) return false;
    }
    return search.length === 0 || record.searchableText.includes(search);
  });
}

export function groupCorpusRecords(
  visible: readonly CorpusRecordIndex[],
  allRecords: readonly CorpusRecordIndex[],
): readonly CorpusGroup[] {
  const totals = new Map<string, number>();
  for (const record of allRecords)
    totals.set(record.corpusId, (totals.get(record.corpusId) ?? 0) + 1);

  const groups = new Map<string, CorpusGroup>();
  for (const record of visible) {
    const current = groups.get(record.corpusId);
    if (current) {
      groups.set(record.corpusId, { ...current, records: [...current.records, record] });
      continue;
    }
    groups.set(record.corpusId, {
      corpusId: record.corpusId,
      corpusTitle: record.corpusTitle,
      corpusStatus: record.corpusStatus,
      family: record.family,
      jurisdiction: record.jurisdiction,
      corpusIndex: record.corpusIndex,
      totalCount: totals.get(record.corpusId) ?? 0,
      records: [record],
    });
  }
  return [...groups.values()].sort((a, b) => a.corpusIndex - b.corpusIndex);
}

export function filterValues(
  records: readonly CorpusRecordIndex[],
  key: "legalForce" | "adoption" | "applicability" | "enforcement" | "factType" | "traceState",
): readonly string[] {
  return [...new Set(records.flatMap((record) => (record[key] ? [record[key]] : [])))].sort();
}

export function humanizeCorpusValue(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
