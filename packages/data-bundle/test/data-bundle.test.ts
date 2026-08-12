import { describe, expect, test } from "bun:test";

import { generateWritDataBundle } from "../src/generate.js";
import { serializeBundle } from "../src/hashing.js";
import { validateWritDataBundle } from "../src/validate.js";

const bundle = generateWritDataBundle();

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

describe("Writ data bundle membership", () => {
  test("exports every manifest-routed record without approval filtering", () => {
    expect(bundle.corpora).toHaveLength(16);
    expect(bundle.records).toHaveLength(72);
    expect(bundle.recordLinks).toHaveLength(6);
    expect(bundle.recordJudgments).toHaveLength(44);

    expect(countBy(bundle.records.map((record) => record.reviewState ?? "none"))).toEqual({
      accepted: 32,
      none: 2,
      draft: 3,
      approved: 34,
      superseded: 1,
    });
    expect(countBy(bundle.records.map((record) => record.recordType))).toEqual({
      political_claim: 32,
      political_entity: 2,
      legal_policy: 3,
      institutional: 35,
    });
  });

  test("uses globally unique stable keys and preserves corpus membership", () => {
    expect(new Set(bundle.records.map((record) => record.recordKey)).size).toBe(72);
    for (const record of bundle.records) {
      expect(record.recordKey).toBe(`${record.corpusId}::${record.recordId}`);
      expect(bundle.corpora.some((corpus) => corpus.corpusId === record.corpusId)).toBe(true);
    }
  });
});

describe("canonical source and provenance", () => {
  test("exports exact reparsed YAML and Writ source slices", () => {
    const yaml = bundle.records.find((record) => record.recordType === "political_claim")!;
    expect(yaml.storedSource.language).toBe("yaml");
    expect(yaml.storedRecord?.machine_id).toBe(yaml.recordId);
    expect(yaml.storedSource.content).toContain(yaml.recordId);

    const writ = bundle.records.find((record) => record.recordType === "institutional")!;
    expect(writ.storedSource.language).toBe("writ");
    expect(writ.compiledRecord?.record_id).toBe(writ.recordId);
    expect(writ.storedSource.content).toContain(writ.recordId);
  });

  test("preserves multiple and unresolved evidence supports separately", () => {
    expect(bundle.records.some((record) => record.evidence.length > 1)).toBe(true);
    expect(
      bundle.records.some((record) =>
        record.evidence.some((support) => support.state === "unresolved"),
      ),
    ).toBe(true);
    for (const record of bundle.records) {
      expect(new Set(record.evidence.map((support) => support.supportId)).size).toBe(
        record.evidence.length,
      );
    }
  });
});

describe("deterministic neutral contract", () => {
  test("validates hashes and is byte-identical across clean generation", () => {
    validateWritDataBundle(bundle);
    const second = generateWritDataBundle();
    expect(serializeBundle(second)).toBe(serializeBundle(bundle));
  });

  test("does not expose web-owned projection fields", () => {
    const rootKeys = Object.keys(bundle);
    expect(rootKeys).toEqual([
      "metadata",
      "catalog",
      "corpora",
      "resources",
      "records",
      "recordLinks",
      "recordJudgments",
    ]);
    const recordKeys = new Set(bundle.records.flatMap((record) => Object.keys(record)));
    for (const forbidden of [
      "corpusIndex",
      "recordIndex",
      "displayId",
      "searchableText",
      "labRecordId",
      "mappedCount",
      "homepageSubset",
      "demoAnalysis",
      "pilotFiles",
    ]) {
      expect(recordKeys.has(forbidden)).toBe(false);
    }
    expect("generatedAt" in bundle.metadata).toBe(false);
  });
});
