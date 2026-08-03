import { describe, expect, test } from "bun:test";

import {
  labRecordChecks,
  labRecordSummaries,
  labRecordView,
  labRecordViews,
  resolveLabRecordId,
} from "../lib/lab-record";
import { LAB_RECORDS, STRUCTURAL_KEYS } from "../lib/lab-record-presentation";
import { demoAnalysisClaimRecords } from "../lib/demo-analysis";

const view = (id: string) => {
  const found = labRecordView(id);
  if (!found) throw new Error(`no view for ${id}`);
  return found;
};

describe("the Lab's curated records", () => {
  test("the seven records are real, in fixture order", () => {
    const ids = labRecordViews().map((record) => record.claimId);
    expect(ids).toEqual([...LAB_RECORDS.map((record) => record.id)]);
    expect(ids).toEqual(["EU-06", "EU-01", "EU-05", "EU-12", "US-03", "US-08A", "US-11"]);

    // Every one is a claim the reviewers accepted, not a curated invention.
    const corpus = new Set(demoAnalysisClaimRecords().map((claim) => claim.claimId));
    for (const id of ids) expect(corpus.has(id)).toBe(true);
  });

  test("every anchor resolves to the passage it claims, and none overlap", () => {
    for (const record of labRecordViews()) {
      const anchored = record.fields.filter((field) => field.anchor !== null);
      const declared = LAB_RECORDS.find((entry) => entry.id === record.claimId)!.anchors;
      expect(anchored).toHaveLength(declared.length);

      const spans = anchored.map((field) => field.anchor!).sort((a, b) => a.start - b.start);
      for (let i = 1; i < spans.length; i += 1) {
        expect(spans[i].start).toBeGreaterThanOrEqual(spans[i - 1].end);
      }
      for (const field of anchored) {
        const { start, end } = field.anchor!;
        const phrase = declared.find((entry) => entry.field === field.key)!.phrase;
        expect(record.source.quote?.slice(start, end)).toBe(phrase);
      }
    }
  });

  test("a field grounded outside the retrieved span carries no anchor", () => {
    // Article 55(1)(a) is quoted alone; its addressee is in the chapeau above it,
    // so the actor must not be highlighted onto words that do not name it.
    const eu06 = view("EU-06");
    expect(eu06.source.quote).toContain("perform model evaluation");
    expect(eu06.source.quote).not.toContain("provider");
    expect(eu06.fields.find((field) => field.key === "actor_type")?.anchor).toBeNull();
    expect(eu06.fields.find((field) => field.key === "legal_force")?.anchor).toBeNull();
    expect(eu06.fields.find((field) => field.key === "applicability_status")?.anchor).toBeNull();
  });

  test("a record with no registered source says so in the registry's own words", () => {
    const eu12 = view("EU-12");
    expect(eu12.source.state).toBe("unresolved");
    expect(eu12.source.quote).toBeNull();
    expect(eu12.source.document).toBeNull();
    expect(eu12.source.unresolvedReason).toBe(
      "no source document is registered for this instrument",
    );
    expect(eu12.fields.every((field) => field.anchor === null)).toBe(true);

    // Voluntary is not rewritten as binding just because the regime behind it is.
    expect(eu12.fields.find((field) => field.key === "legal_force")?.raw).toBe("voluntary");
    expect(eu12.fields.find((field) => field.key === "underlying_regime_force")?.raw).toBe(
      "binding",
    );
  });

  test("an inherited passage is reported as inherited", () => {
    const us08a = view("US-08A");
    expect(us08a.source.state).toBe("inherited");
    expect(us08a.source.passageRowId).toBe("US-08");
    expect(us08a.explanation.reviewerNote.inherited).toBe(true);
    expect(us08a.fields.find((field) => field.key === "binding_scope")?.raw).toBe(
      "federal_agencies_only",
    );
  });

  test("no recorded field is dropped from the view", () => {
    for (const record of labRecordViews()) {
      const claim = demoAnalysisClaimRecords().find((item) => item.claimId === record.claimId)!;
      const recorded = Object.entries(claim.fields as unknown as Record<string, unknown>)
        .filter(([key, value]) => {
          if (STRUCTURAL_KEYS.has(key)) return false;
          if (value === undefined || value === null) return false;
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === "object") return Object.keys(value).length > 0;
          return String(value).trim() !== "";
        })
        .map(([key]) => key)
        .sort();
      const shown = record.fields.map((field) => field.key).sort();
      expect(shown).toEqual(recorded as typeof shown);
    }
  });

  test("the fields the pilot turns on survive into the view", () => {
    // Documentation is not evaluation, and the two records say so themselves.
    expect(view("EU-01").fields.find((f) => f.key === "conduct_type")?.raw).toBe(
      "evaluation_documentation",
    );
    expect(view("EU-06").fields.find((f) => f.key === "conduct_type")?.raw).toBe(
      "model_evaluation",
    );
    // Voluntary guidance about evaluation stays voluntary.
    expect(view("US-03").fields.find((f) => f.key === "legal_force")?.raw).toBe("voluntary");
    // A proposal stays a proposal.
    expect(view("US-11").fields.find((f) => f.key === "applicability_status")?.raw).toBe(
      "not_yet_applicable",
    );
  });

  test("unknown reaches the reader as unknown", () => {
    for (const id of ["EU-01", "EU-05", "EU-06"]) {
      const field = view(id).fields.find((entry) => entry.key === "enforcement_status");
      expect(field?.value).toBe("unknown");
      expect(field?.isUnknown).toBe(true);
    }
    // …and a value that is not unknown is never marked as one.
    expect(view("US-03").fields.find((f) => f.key === "enforcement_status")?.isUnknown).toBe(false);
  });
});

describe("the code view", () => {
  test("is deterministic and covers every field", () => {
    for (const record of labRecordViews()) {
      expect(labRecordView(record.claimId)!.code.text).toBe(record.code.text);
      for (const field of record.fields) {
        expect(field.codeLines.length).toBeGreaterThan(0);
        for (const n of field.codeLines) {
          expect(record.code.lines[n - 1]?.field).toBe(field.key);
        }
      }
    }
  });

  test("is the record, and never claims to be a Writ query", () => {
    const code = view("EU-06").code;
    expect(code.filename).toBe("eu-06.record.yaml");
    expect(code.text).toContain("row_id: EU-06");
    expect(code.text).toContain("conduct_type: model_evaluation");
    expect(code.text).toContain("enforcement_status: unknown");
    expect(code.text).toContain("This is the record. A Writ query is a separate file.");
    expect(code.text).not.toContain("commitment");
    expect(code.text).not.toContain("score");
    expect(code.text).not.toContain(".writ");
  });
});

describe("record status", () => {
  test("reports states rather than a score", () => {
    for (const record of labRecordViews()) {
      const checks = labRecordChecks(record.claimId);
      expect(checks.map((check) => check.key)).toEqual([
        "source",
        "actor",
        "conduct",
        "force",
        "applicability",
        "enforcement",
        "reviewer_note",
      ]);
      for (const check of checks) {
        expect(check.label).not.toMatch(/\d+\s*\/\s*\d+/);
        expect(check.note ?? "").not.toContain("%");
      }
    }
  });

  test("an exception classifies no conduct, and that is not a failure", () => {
    const conduct = labRecordChecks("EU-05").find((check) => check.key === "conduct")!;
    expect(conduct.state).toBe("not_recorded");
    expect(conduct.note).toBe("Record type: Exception rule.");
  });

  test("a proposal names who acts now and who would be reached", () => {
    const actor = labRecordChecks("US-11").find((check) => check.key === "actor")!;
    expect(actor.state).toBe("recorded");
    expect(actor.value).toContain("Federal agency");
    expect(actor.value).toContain("Market provider");
  });

  test("a missing source and a recorded unknown are different states", () => {
    const missing = labRecordChecks("EU-12").find((check) => check.key === "source")!;
    expect(missing.state).toBe("not_recorded");
    expect(missing.note).toBe("no source document is registered for this instrument");

    const unknown = labRecordChecks("EU-06").find((check) => check.key === "enforcement")!;
    expect(unknown.state).toBe("recorded_unknown");
    expect(unknown.value).toBe("unknown");
  });

  test("a government-use duty is never described as a market-wide one", () => {
    const force = labRecordChecks("US-08A").find((check) => check.key === "force")!;
    expect(force.value).toBe("Binding");
    expect(force.note).toContain("federal agencies only");
  });
});

describe("resolving a requested record", () => {
  test("an exact request is honoured", () => {
    expect(resolveLabRecordId("US-03")).toEqual({
      id: "US-03",
      requested: "US-03",
      how: "exact",
    });
  });

  test("a sibling of a curated bundle resolves to that bundle's curated record", () => {
    expect(resolveLabRecordId("US-08B")).toEqual({
      id: "US-08A",
      requested: "US-08B",
      how: "parent",
    });
  });

  test("a record the Lab does not carry falls back and says which was asked for", () => {
    const resolved = resolveLabRecordId("EU-04");
    expect(resolved.id).toBe("EU-06");
    expect(resolved.requested).toBe("EU-04");
    expect(resolved.how).toBe("default");
  });

  test("no request opens the binding model-evaluation duty", () => {
    expect(resolveLabRecordId(null)).toEqual({ id: "EU-06", requested: null, how: "default" });
  });
});

describe("the record selector", () => {
  test("describes each record from the record itself", () => {
    const summaries = labRecordSummaries();
    expect(summaries).toHaveLength(7);
    expect(summaries.filter((summary) => !summary.hasSource).map((s) => s.id)).toEqual(["EU-12"]);
    for (const summary of summaries) {
      expect(summary.summary.length).toBeGreaterThan(0);
      expect(["EU", "US"]).toContain(summary.jurisdiction);
    }
  });
});
