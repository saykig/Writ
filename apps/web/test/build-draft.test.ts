import { describe, expect, test } from "bun:test";

import {
  DRAFT_VERSION,
  decodeDraft,
  draftSourceState,
  draftToClaimFields,
  draftToYaml,
  emptyDraft,
  encodeDraft,
  needsLegalForce,
  selectedPassage,
  type BuildDraft,
} from "../lib/build-draft";
import { recordChecks } from "../lib/record-checks";
import { buildVocabulary } from "../lib/build-vocabulary";
import { demoAnalysisClaimRecords } from "../lib/demo-analysis";

function draft(patch: (d: BuildDraft) => void): BuildDraft {
  const base = emptyDraft();
  patch(base);
  return base;
}

const checksFor = (d: BuildDraft) =>
  recordChecks({
    fields: draftToClaimFields(d),
    source: draftSourceState(d),
    interpretation: { text: d.record.uncertainty, inherited: false },
  });

describe("the draft codec", () => {
  test("round-trips", () => {
    const original = draft((d) => {
      d.corpus.name = "EU–US AI evaluation";
      d.source.passage = "Agencies must develop pre-deployment testing.";
      d.record.recordType = "obligation";
      d.selection = { start: 0, end: 8 };
    });
    expect(decodeDraft(encodeDraft(original))).toEqual(original);
  });

  test("a draft from another version is discarded rather than migrated", () => {
    const stale = JSON.stringify({ ...emptyDraft(), version: DRAFT_VERSION + 1 });
    expect(decodeDraft(stale)).toBeNull();
    expect(decodeDraft("not json")).toBeNull();
    expect(decodeDraft(null)).toBeNull();
  });

  test("a confirmed selection narrows the passage the record rests on", () => {
    const d = draft((item) => {
      item.source.passage = "Conduct Pre-Deployment Testing. Agencies must develop testing.";
      item.selection = { start: 0, end: 30 };
    });
    expect(selectedPassage(d)).toBe("Conduct Pre-Deployment Testing");
    expect(selectedPassage({ ...d, selection: null })).toBe(d.source.passage);
  });
});

describe("the form adapts to the corpus family", () => {
  test("legal force applies to policy and to nothing else", () => {
    expect(needsLegalForce(emptyDraft())).toBe(true);
    for (const family of ["empirical", "theoretical"] as const) {
      const d = draft((item) => {
        item.corpus.family = family;
        item.record.legalForce = "binding";
      });
      expect(needsLegalForce(d)).toBe(false);
      // A force entered before the family changed must not leak into the record.
      expect(draftToClaimFields(d).legal_force).toBeUndefined();
      expect(draftToYaml(d).text).not.toContain("legal_force");
    }
  });
});

describe("validating a draft", () => {
  test("a fresh draft reports what is not recorded, and calls none of it a failure", () => {
    const checks = checksFor(emptyDraft());
    expect(checks).toHaveLength(7);
    expect(checks.every((check) => check.state !== "recorded")).toBe(true);
    for (const check of checks) {
      expect(check.value ?? "").not.toMatch(/fail|error|invalid/i);
    }
  });

  test("a draft with no passage reads like a record with no registered source", () => {
    const source = checksFor(emptyDraft()).find((check) => check.key === "source")!;
    expect(source.state).toBe("not_recorded");
    expect(source.note).toBe("No source passage has been entered for this draft.");
  });

  test("entering a passage links the source", () => {
    const d = draft((item) => {
      item.source.title = "Regulation (EU) 2024/1689";
      item.source.passage = "perform model evaluation";
    });
    const source = checksFor(d).find((check) => check.key === "source")!;
    expect(source.state).toBe("recorded");
    expect(source.value).toBe("Regulation (EU) 2024/1689");
  });

  test("a field set to unknown is preserved as unknown, never as unrecorded", () => {
    const d = draft((item) => {
      item.record.enforcement = "unknown";
    });
    const enforcement = checksFor(d).find((check) => check.key === "enforcement")!;
    expect(enforcement.state).toBe("recorded_unknown");
    expect(enforcement.value).toBe("unknown");
    expect(draftToYaml(d).text).toContain("enforcement_status: unknown");
  });
});

describe("the structured output", () => {
  test("is an output of the form, and says it belongs to no corpus", () => {
    const d = draft((item) => {
      item.corpus.name = "Test corpus";
      item.record.recordType = "obligation";
      item.record.conditions = "Applies from 2 August 2025.";
    });
    const yaml = draftToYaml(d).text;
    expect(yaml).toContain("# Draft record — not published, not part of any corpus.");
    expect(yaml).toContain("record_type: obligation");
    // A field the reviewed schema has no home for is marked as a draft note
    // rather than presented as a corpus field.
    expect(yaml).toContain("draft notes");
    expect(yaml).toContain("conditions:");
  });

  test("an empty field is absent rather than written out empty", () => {
    expect(draftToYaml(emptyDraft()).text).not.toContain("actor_type:");
  });
});

describe("the vocabulary", () => {
  test("offers only terms the reviewed corpus already uses, plus unknown", () => {
    const vocabulary = buildVocabulary();
    const corpus = demoAnalysisClaimRecords();
    const used = (field: "legal_force" | "conduct_type" | "actor_type") =>
      new Set(
        corpus
          .map((claim) => claim.fields[field])
          .filter((value): value is string => typeof value === "string"),
      );

    for (const [options, field] of [
      [vocabulary.legalForce, "legal_force"],
      [vocabulary.conductType, "conduct_type"],
      [vocabulary.actorType, "actor_type"],
    ] as const) {
      for (const option of options) {
        if (option === "unknown") continue;
        expect(used(field).has(option)).toBe(true);
      }
      expect(options).toContain("unknown");
    }
  });

  test("names the record types the corpus carries without a conduct", () => {
    // An exception classifies no conduct of its own; the form says so rather
    // than leaving an empty field to read as an omission.
    expect(buildVocabulary().recordTypesWithoutConduct).toContain("exception_rule");
  });
});
