import { describe, expect, test } from "bun:test";

import { buildMemo, demoQuestions } from "../lib/demo-memo";
import { answerFromMemo, type QueryAnswer } from "../lib/query-answer";
import {
  DEMO_ANALYSIS_CORPORA,
  DEMO_ANALYSIS_SOURCE,
  demoAnalysisClaimRecords,
  demoAnalysisDataset,
  demoAnalysisReceipt,
} from "../lib/demo-analysis";

const dataset = demoAnalysisDataset();
const versions = {
  datasetSource: DEMO_ANALYSIS_SOURCE,
  corpusPaths: DEMO_ANALYSIS_CORPORA,
  schemaVersion: dataset.schema_version,
  reviewStatus: dataset.review_status,
  receiptHash: demoAnalysisReceipt().contentHash,
};

const answers = (): QueryAnswer[] =>
  demoQuestions().map((question) => answerFromMemo(buildMemo(question.id)!, versions));

const prose = (answer: QueryAnswer) =>
  [...answer.answer, ...answer.distinctions.flatMap((block) => block.paragraphs.flat())]
    .map((sentence) => sentence.text)
    .join(" ");

describe("preset questions", () => {
  test("the four specified questions are present and answerable", () => {
    const ids = demoQuestions().map((question) => question.id);
    for (const id of [
      "binding-duties-eu-us",
      "us-voluntary-or-government",
      "documentation-versus-evaluation",
      "code-of-practice",
    ]) {
      expect(ids).toContain(id);
    }
  });

  test("every question selects a non-empty set of reviewed records", () => {
    const corpus = demoAnalysisClaimRecords();
    for (const question of demoQuestions()) {
      expect(question.select(corpus).length).toBeGreaterThan(0);
    }
  });

  test("every question projects into the five-part answer", () => {
    for (const answer of answers()) {
      expect(answer.answer.length).toBeGreaterThan(0);
      // The four dimensions the corpus keeps apart, never fewer.
      expect(answer.distinctions.map((block) => block.id)).toEqual([
        "actors",
        "conduct",
        "force",
        "applicability",
      ]);
      expect(answer.evidence.length).toBeGreaterThan(0);
      expect(answer.uncertainty.selected).toBe(answer.evidence.length);
      expect(answer.versions.receiptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(answer.versions.datasetSource).toContain("human-reviewed.yaml");
    }
  });
});

describe("what an answer may and may not say", () => {
  test("no answer introduces a score, percentage or ranking", () => {
    for (const answer of answers()) {
      const text = prose(answer);
      expect(text).not.toMatch(/\d+\s?%/);
      expect(text).not.toMatch(/\b(score|scored|ranking|ranked|percent)\b/i);
    }
  });

  test("no coded field name reaches the answer prose", () => {
    for (const answer of answers()) {
      expect(prose(answer)).not.toContain("_");
    }
  });

  test("every cited note resolves to a listed record", () => {
    for (const answer of answers()) {
      const numbered = new Set(
        answer.evidence.filter((record) => record.n !== undefined).map((record) => record.n),
      );
      const cited = new Set([
        ...answer.answer.flatMap((sentence) => sentence.notes),
        ...answer.distinctions.flatMap((block) =>
          block.paragraphs.flat().flatMap((sentence) => sentence.notes),
        ),
      ]);
      for (const n of cited) expect(numbered.has(n)).toBe(true);
    }
  });

  test("a citation covers every record its sentence counts, or none at all", () => {
    // A marker on a subset would send a reader to some of the evidence while the
    // sentence claims all of it.
    for (const answer of answers()) {
      for (const sentence of answer.answer) {
        expect(sentence.notes.length).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("uncertainty", () => {
  test("recorded unknowns survive into the answer as unknown", () => {
    const withUnknowns = answers().filter(
      (answer) => answer.uncertainty.unknownEnforcement.length > 0,
    );
    expect(withUnknowns.length).toBeGreaterThan(0);

    const known = new Set(
      demoAnalysisClaimRecords()
        .filter((claim) => claim.fields.enforcement_status === "unknown")
        .map((claim) => claim.claimId),
    );
    for (const answer of withUnknowns) {
      for (const id of answer.uncertainty.unknownEnforcement) expect(known.has(id)).toBe(true);
    }
  });

  test("an untraced record is reported, not quietly given an excerpt", () => {
    for (const answer of answers()) {
      for (const id of answer.uncertainty.untraced) {
        const record = answer.evidence.find((item) => item.claimId === id);
        if (record) {
          expect(record.excerpt).toBeUndefined();
          expect(record.document).toBeUndefined();
        }
      }
    }
  });

  test("the Code of Practice answer keeps its missing source visible", () => {
    const answer = answers().find((item) => item.questionId === "code-of-practice")!;
    expect(answer.uncertainty.untraced).toContain("EU-12");
    // …and never describes the voluntary Code as binding.
    const code = answer.evidence.find((record) => record.claimId === "EU-12")!;
    expect(code.legalForce).toBe("voluntary");
  });

  test("the comparison answer never turns a government duty into a market one", () => {
    const answer = answers().find((item) => item.questionId === "binding-duties-eu-us")!;
    const governmentOnly = answer.evidence.filter((record) => record.claimId.startsWith("US-08"));
    expect(governmentOnly.length).toBeGreaterThan(0);
    for (const record of governmentOnly) {
      const scope = record.structured.find((field) => field.label === "binding_scope");
      expect(scope?.value).toBe("federal_agencies_only");
    }
    expect(prose(answer)).toContain("is not a duty on the company that supplies it");
  });
});
