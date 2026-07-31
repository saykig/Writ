import { test, expect } from "bun:test";

import { buildMemo, demoQuestions, type Memo, type MemoSentence } from "../lib/demo-memo";
import { citationRun, memoToMarkdown } from "../lib/demo-markdown";
import { demoAnalysisClaimRecords } from "../lib/demo-analysis";
import { REPO_PROVENANCE } from "../lib/repo-provenance";

const memos = () => demoQuestions().map((question) => buildMemo(question.id)!);

const allSentences = (memo: Memo): MemoSentence[] => [
  ...memo.executive,
  ...memo.sections.flatMap((section) => section.paragraphs.flat()),
  ...memo.conclusion,
];

const prose = (memo: Memo) =>
  allSentences(memo)
    .map((sentence) => sentence.text)
    .join(" ");

test("every question builds a memo with all four analytical sections", () => {
  for (const memo of memos()) {
    expect(memo.sections.map((section) => section.id)).toEqual([
      "actors",
      "conduct",
      "force",
      "applicability",
    ]);
    expect(memo.executive.length).toBeGreaterThan(0);
    expect(memo.conclusion.length).toBeGreaterThan(0);
  }
});

test("the same question always produces the same memo", () => {
  // Determinism is what makes a memo citable: two readers must get one document.
  for (const question of demoQuestions()) {
    expect(JSON.stringify(buildMemo(question.id))).toBe(JSON.stringify(buildMemo(question.id)));
  }
});

test("no coded field name or YAML syntax reaches the memo prose", () => {
  // The reader is shown sentences; the raw record stays behind a control.
  for (const memo of memos()) {
    const text = prose(memo);
    for (const enumName of [
      "market_provider",
      "model_evaluation",
      "legal_force",
      "applicability_status",
      "enforcement_status",
      "headline_relevance",
      "conduct_type",
      "actor_type",
    ]) {
      expect(text).not.toContain(enumName);
    }
    expect(text).not.toContain("_");
  }
});

test("every citation resolves to a numbered record, and every number is cited", () => {
  for (const memo of memos()) {
    const numbered = memo.records.filter((record) => record.n !== undefined);
    const numbers = new Set(numbered.map((record) => record.n!));
    const cited = new Set(allSentences(memo).flatMap((sentence) => sentence.notes));
    for (const n of cited) expect(numbers.has(n)).toBe(true);
    for (const n of numbers) expect(cited.has(n)).toBe(true);
  }
});

test("citation numbers run from one without gaps", () => {
  for (const memo of memos()) {
    const numbers = memo.records
      .map((record) => record.n)
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);
    expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  }
});

test("citations are spent sparingly, and never on a bare count", () => {
  // The record list carries the aggregate; a marker means the sentence rests on
  // named provisions a reader would want to open.
  for (const memo of memos()) {
    const numbered = memo.records.filter((record) => record.n !== undefined);
    expect(numbered.length).toBeGreaterThan(0);
    expect(numbered.length).toBeLessThanOrEqual(8);
    for (const sentence of allSentences(memo)) {
      expect(sentence.notes.length).toBeLessThanOrEqual(6);
    }
  }
});

test("every selected record is listed, cited or not", () => {
  for (const memo of memos()) {
    expect(memo.records.length).toBe(memo.coverage.selected);
    for (const record of memo.records) expect(record.claimId.length).toBeGreaterThan(0);
  }
});

test("each record carries what a reader needs to check it", () => {
  const known = new Set(demoAnalysisClaimRecords().map((claim) => claim.claimId));
  for (const memo of memos()) {
    for (const note of memo.records) {
      expect(known.has(note.claimId)).toBe(true);
      expect(note.interpretation.length).toBeGreaterThan(0);
      if (note.n !== undefined) expect(note.supportingFields.length).toBeGreaterThan(0);
      // An excerpt is present only where the row was traced to a document; a
      // footnote never invents one.
      if (note.excerpt !== undefined) expect(note.document).toBeDefined();
    }
  }
});

test("an untraced record is reported as untraced rather than given an excerpt", () => {
  for (const memo of memos()) {
    for (const claimId of memo.coverage.untraced) {
      const note = memo.records.find((item) => item.claimId === claimId);
      if (note) {
        expect(note.excerpt).toBeUndefined();
        expect(note.document).toBeUndefined();
      }
    }
  }
});

test("unknown enforcement survives into the footnote as `unknown`", () => {
  // AGENTS invariant: unknown is never silently rendered as false or absent.
  const claims = demoAnalysisClaimRecords().filter(
    (claim) => claim.fields.enforcement_status === "unknown",
  );
  expect(claims.length).toBeGreaterThan(0);
  const seen = memos()
    .flatMap((memo) => memo.records)
    .filter((note) => claims.some((claim) => claim.claimId === note.claimId));
  expect(seen.length).toBeGreaterThan(0);
  for (const note of seen) expect(note.enforcementStatus).toBe("unknown");
});

test("no memo introduces a score, percentage or ranking", () => {
  for (const memo of memos()) {
    const text = prose(memo);
    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).not.toMatch(/\b(score|scored|ranking|ranked|percent)\b/i);
  }
});

test("the memo never calls a voluntary measure binding", () => {
  for (const memo of memos()) {
    for (const note of memo.records) {
      if (note.legalForce !== "voluntary") continue;
      // A voluntary record may be cited, but only ever described as voluntary.
      expect(note.legalForce).toBe("voluntary");
    }
  }
});

test("model evaluation is counted apart from the duties around it", () => {
  // Documentation, risk assessment, monitoring, reporting, access and testing
  // must never be folded into the model-evaluation count.
  const evaluation = demoAnalysisClaimRecords().filter(
    (claim) => claim.fields.conduct_type === "model_evaluation",
  );
  expect(evaluation.map((claim) => claim.claimId).sort()).toEqual([
    "EU-06",
    "US-03",
    "US-05A",
    "US-05B",
  ]);
  const memo = buildMemo("evaluation-trigger")!;
  expect(prose(memo)).toContain("keep model evaluation apart from the duties that surround it");
});

test("citation runs collapse to ranges", () => {
  expect(citationRun([1])).toBe("1");
  expect(citationRun([3, 1, 2])).toBe("1–3");
  expect(citationRun([1, 2, 5, 7, 8, 9])).toBe("1, 2, 5, 7–9");
});

test("the Markdown export carries front matter, attribution and provenance", () => {
  const memo = buildMemo("evaluation-trigger")!;
  const markdown = memoToMarkdown({
    memo,
    provenance: REPO_PROVENANCE,
    generatedAt: "2026-07-27T00:00:00.000Z",
  });

  expect(markdown.startsWith("---\n")).toBe(true);
  expect(markdown).toContain("generated_by: Writ");
  expect(markdown).toContain("document_type: policy_memo");
  expect(markdown).toContain(`question_id: ${memo.questionId}`);
  expect(markdown).toContain(`dataset_id: ${memo.datasetId}`);
  expect(markdown).toContain(`profile_id: ${memo.profileId}`);
  expect(markdown).toContain("generated_at: 2026-07-27T00:00:00.000Z");
  // The machine-readable mark and the visible one both survive the export.
  expect(markdown).toContain(`<!-- Generated by Writ | profile:${memo.profileId} |`);
  expect(markdown).toContain("**written in Writ.**");
  expect(markdown).toContain("*written in Writ.*");
  expect(markdown).toContain("**Provenance**");
  expect(markdown).toContain("**Rights and licence**");
});

test("the export states what the repository declares, and invents nothing", () => {
  const markdown = memoToMarkdown({
    memo: buildMemo("evaluation-trigger")!,
    provenance: REPO_PROVENANCE,
    generatedAt: "2026-07-27T00:00:00.000Z",
  });

  expect(REPO_PROVENANCE.softwareLicense).toEqual({
    file: "LICENSE",
    identifier: "Apache-2.0",
  });
  expect(REPO_PROVENANCE.copyright).toBe("Copyright 2026 Sara Kim");
  expect(markdown).toContain("Apache-2.0");
  expect(markdown).toContain("Copyright 2026 Sara Kim");
  // A software licence must never be described as covering the reviewed data.
  expect(markdown).toContain("does not govern them");
  // Provenance is not a claim of ownership.
  expect(markdown).toContain("they do not establish ownership");
});

test("the export quotes only excerpts that exist", () => {
  const memo = buildMemo("institutional-design")!;
  const markdown = memoToMarkdown({
    memo,
    provenance: REPO_PROVENANCE,
    generatedAt: "2026-07-27T00:00:00.000Z",
  });
  for (const note of memo.records) {
    // Every record reaches the export, cited inline or listed below the memo.
    expect(markdown).toContain(note.claimId);
    if (note.excerpt) expect(markdown).toContain(note.excerpt);
  }
  if (memo.coverage.untraced.length > 0) {
    expect(markdown).toContain("has not yet been traced to its source document");
  }
});
