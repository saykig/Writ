import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const g7 = join(root, "archive/compatibility/g7/2025-ai-sme");
const g7Benchmark = join(
  root,
  "internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction",
);
const g20 = join(root, "archive/compatibility/g20/2024-rio");

const json = <T>(...parts: string[]): T => JSON.parse(readFileSync(join(...parts), "utf8")) as T;
const digest = (path: string): string =>
  `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;

describe("Prompt 6 multilateral corpus preservation", () => {
  test("preserves exact G7 corpus and evaluator counts", () => {
    const actors = json<unknown[]>(g7, "records/actors.json");
    const actions = json<{ id: string; actor_ids: string[] }[]>(g7, "records/actions.json");
    const assignments = json<{ action_id: string }[]>(g7Benchmark, "assignments.json");
    const actionReviews = json<unknown[]>(g7, "reviews/action-reviews.json");
    const assignmentReviews = json<unknown[]>(g7Benchmark, "assignment-reviews.json");
    const jurisdictions = new Set(actions.flatMap((action) => action.actor_ids));

    expect(actors).toHaveLength(8);
    expect(actions).toHaveLength(87);
    expect(assignments).toHaveLength(87);
    expect(actionReviews).toHaveLength(87);
    expect(assignmentReviews).toHaveLength(87);
    expect(jurisdictions.size).toBe(8);
    expect(new Set(actions.map((action) => action.id)).size).toBe(87);
    expect(new Set(assignments.map((assignment) => assignment.action_id))).toEqual(
      new Set(actions.map((action) => action.id)),
    );
  });

  test("preserves exact Rio counts and incomplete coverage", () => {
    const statements = json<unknown[]>(g20, "records/political-statements.json");
    const selections = json<unknown[]>(g20, "records/assessment-selections.json");
    const reports = json<unknown[]>(g20, "records/published-reports.json");
    const judgments = json<unknown[]>(g20, "records/published-judgments.json");
    const reconciliation = json<
      {
        expected_inventory_count: number;
        extracted_inventory_count: number;
        missing_coverage_count: number;
        validation_status: string;
        missing_records_fabricated: boolean;
      }[]
    >(g20, "provenance/reconciliation.json");
    const reviews = json<unknown[]>(g20, "reviews/review-queue.json");

    expect(statements).toHaveLength(13);
    expect(selections).toHaveLength(13);
    expect(reports).toHaveLength(2);
    expect(judgments).toHaveLength(546);
    expect(reconciliation).toHaveLength(1);
    expect(reviews).toHaveLength(15);
    expect(reconciliation[0]).toMatchObject({
      expected_inventory_count: 174,
      extracted_inventory_count: 13,
      missing_coverage_count: 161,
      validation_status: "incomplete",
      missing_records_fabricated: false,
    });
  });

  test("keeps source-reported judgments distinct from Writ-derived results", () => {
    const sourceJudgments = [
      ...json<Record<string, unknown>[]>(g7, "records/published-judgments.json"),
      ...json<Record<string, unknown>[]>(g20, "records/published-judgments.json"),
    ];
    const derived = json<Record<string, unknown>[]>(g7Benchmark, "expected-results.json");

    expect(sourceJudgments).toHaveLength(554);
    for (const judgment of sourceJudgments) {
      expect(judgment.origin).toBe("source_reported");
      expect(judgment.writ_derived).toBe(false);
      expect(judgment).toHaveProperty("reported_value");
      expect(judgment).toHaveProperty("source_passage_ref");
    }
    for (const result of derived) {
      expect(result.origin).toBe("writ_derived");
      expect(result.writ_derived).toBe(true);
      expect(result).toHaveProperty("methodology_id");
      expect(result).toHaveProperty("methodology_version");
      expect(result).toHaveProperty("input_record_ids");
      expect(result).toHaveProperty("trace_id");
      expect(result).not.toHaveProperty("reported_value");
    }
  });

  test("queries G7 actions and G20 statements/actions without evaluating", () => {
    const g7Actions = json<unknown[]>(g7, "records/actions.json");
    const g20Statements = json<unknown[]>(g20, "records/political-statements.json");
    const g20Actions = json<unknown[]>(g20, "records/government-or-institutional-actions.json");

    expect(g7Actions).toHaveLength(87);
    expect(g20Statements).toHaveLength(13);
    expect(g20Actions).toEqual([]);
  });

  test("migration maps resolve every stable record identifier", () => {
    const g7Map = json<{ entries: { active_action_id: string }[] }>(g7, "migration-map.json");
    const g20Map = json<{
      entries: {
        statement_id?: string;
        published_judgment_id?: string;
      }[];
    }>(g20, "migration-map.json");
    const g7Actions = json<{ id: string }[]>(g7, "records/actions.json");
    const g20Statements = json<{ statement_id: string }[]>(
      g20,
      "records/political-statements.json",
    );
    const g20Judgments = json<{ assessment_id: string }[]>(g20, "records/published-judgments.json");

    expect(g7Map.entries.map((entry) => entry.active_action_id)).toEqual(
      g7Actions.map((action) => action.id),
    );
    expect(
      new Set(g20Map.entries.flatMap((entry) => (entry.statement_id ? [entry.statement_id] : []))),
    ).toEqual(new Set(g20Statements.map((record) => record.statement_id)));
    expect(
      new Set(
        g20Map.entries.flatMap((entry) =>
          entry.published_judgment_id ? [entry.published_judgment_id] : [],
        ),
      ),
    ).toEqual(new Set(g20Judgments.map((record) => record.assessment_id)));
  });

  test("all source passages resolve and frozen source hashes verify", () => {
    const g7Manifest = json<{
      document_version: { sha256: string };
      passages: { id: string; anchor_hash: string }[];
    }>(g7, "sources/source-manifest.json");
    const g7Passages = new Set(g7Manifest.passages.map((passage) => passage.id));
    const g7Actions = json<{ source_passage_ids: string[] }[]>(g7, "records/actions.json");
    const g7Judgments = json<{ source_passage_ref: string }[]>(
      g7,
      "records/published-judgments.json",
    );
    expect(
      g7Actions.every((action) => action.source_passage_ids.every((id) => g7Passages.has(id))),
    ).toBe(true);
    expect(g7Judgments.every((judgment) => g7Passages.has(judgment.source_passage_ref))).toBe(true);
    expect(
      g7Manifest.passages.every((passage) => /^sha256:[0-9a-f]{64}$/.test(passage.anchor_hash)),
    ).toBe(true);
    expect(digest(join(g7, "sources/g7-2025-ai-sme-chapter.pdf"))).toBe(
      g7Manifest.document_version.sha256,
    );

    const g20Passages = json<{ id: string; document_id: string; passage_hash: string }[]>(
      g20,
      "passages/source-passages.json",
    );
    const g20PassageIds = new Set(g20Passages.map((passage) => passage.id));
    const g20Statements = json<{ source_passage_ids: string[] }[]>(
      g20,
      "records/political-statements.json",
    );
    const g20Judgments = json<{ source_passage_ref: string }[]>(
      g20,
      "records/published-judgments.json",
    );
    expect(
      g20Statements.every((statement) =>
        statement.source_passage_ids.every((id) => g20PassageIds.has(id)),
      ),
    ).toBe(true);
    expect(g20Judgments.every((judgment) => g20PassageIds.has(judgment.source_passage_ref))).toBe(
      true,
    );

    const g20Sources = json<{
      document_versions: {
        document_id: string;
        fixture_path: string;
        excerpt_sha256: string;
      }[];
    }>(g20, "sources/source-manifest.json");
    for (const source of g20Sources.document_versions) {
      // The manifest is archived material and still records the dataset-relative
      // path from the pre-archive layout. Its bytes are frozen, so the recorded
      // path is rebased onto the archive root rather than rewritten in place.
      const fixture = join(g20, source.fixture_path.split("/2024-rio/")[1]!);
      expect(digest(fixture)).toBe(source.excerpt_sha256);
      const scoresPassage = g20Passages.find(
        (passage) => passage.document_id === source.document_id && passage.id.endsWith(".scores"),
      );
      expect(scoresPassage?.passage_hash).toBe(source.excerpt_sha256);
    }
  });
});
