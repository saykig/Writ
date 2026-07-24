import { describe, expect, test } from "bun:test";

import { g7AssessmentPreview, g7AssessmentPreviews, g7EvidenceView } from "../lib/g7-assessments";

describe("G7 homepage assessment selector data", () => {
  test("derives all eight previews from the frozen benchmark", () => {
    const members = g7AssessmentPreviews();
    expect(members).toHaveLength(8);
    expect(members.map((member) => member.name)).toEqual([
      "Canada",
      "France",
      "Germany",
      "Italy",
      "Japan",
      "United Kingdom",
      "United States",
      "European Union",
    ]);
    expect(members.every((member) => member.topic === "AI adoption by SMEs")).toBe(true);
    expect(members.every((member) => member.year === 2025)).toBe(true);
    expect(members.every((member) => member.publishedResult === member.writResult)).toBe(true);
    expect(members.every((member) => member.reviewedActions > 0)).toBe(true);
  });

  test("resolves shareable member IDs without accepting unknown members", () => {
    expect(g7AssessmentPreview("canada")?.name).toBe("Canada");
    expect(g7AssessmentPreview("european_union")?.name).toBe("European Union");
    expect(g7AssessmentPreview("unknown")).toBeUndefined();
  });

  test("projects the selected member's frozen reviewed evidence for Writ Lab", () => {
    const evidence = g7EvidenceView("canada");
    expect(evidence).toBeDefined();
    expect(evidence?.actions).toHaveLength(g7AssessmentPreview("canada")?.reviewedActions ?? 0);
    expect(evidence?.actions.every((action) => action.label.length > 0)).toBe(true);
    expect(evidence?.actions.every((action) => action.passage?.quote)).toBe(true);
    expect(evidence?.actions.every((action) => action.review?.reviewerId)).toBe(true);
    expect(g7EvidenceView("not-a-member")).toBeUndefined();
  });
});
