// Evaluation runs, immutable receipts, and benchmark discrepancies.
import type { DbClient } from "../client.js";
import type {
  DiscrepancyInput,
  EvaluationRunInput,
  ReceiptInput,
} from "../types.js";
import { json, maybe, one } from "./shared.js";

export interface EvaluationRunRow {
  id: string;
  methodology_bundle_id: string;
  interpretation_profile_id: string;
  evidence_snapshot_id: string;
  commitment_id: string;
  subject_id: string;
  as_of: Date;
  cutoff: Date;
  evaluator_build_hash: string;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

export interface ReceiptRow {
  id: string;
  evaluation_run_id: string;
  result: string;
  result_status: string;
  receipt: unknown;
  canonical_hash: string;
  signature: unknown;
  created_at: Date;
}

export function evaluationsRepository(sql: DbClient) {
  return {
    async insertRun(input: EvaluationRunInput): Promise<EvaluationRunRow> {
      const rows = await sql<EvaluationRunRow[]>`
        INSERT INTO evaluation_runs (
          id, methodology_bundle_id, interpretation_profile_id, evidence_snapshot_id,
          commitment_id, subject_id, as_of, cutoff, evaluator_build_hash, status,
          started_at, completed_at
        ) VALUES (
          ${input.id}, ${input.methodology_bundle_id}, ${input.interpretation_profile_id},
          ${input.evidence_snapshot_id}, ${input.commitment_id}, ${input.subject_id},
          ${input.as_of}, ${input.cutoff}, ${input.evaluator_build_hash},
          ${input.status ?? "queued"}, ${input.started_at ?? null}, ${input.completed_at ?? null}
        )
        RETURNING *`;
      return one(rows, "evaluation_run");
    },

    async getRun(id: string): Promise<EvaluationRunRow | null> {
      return maybe(await sql<EvaluationRunRow[]>`SELECT * FROM evaluation_runs WHERE id = ${id}`);
    },

    async setRunStatus(
      id: string,
      status: string,
      timestamps: { started_at?: string | Date; completed_at?: string | Date } = {},
    ): Promise<void> {
      await sql`
        UPDATE evaluation_runs SET
          status = ${status},
          started_at = COALESCE(${timestamps.started_at ?? null}, started_at),
          completed_at = COALESCE(${timestamps.completed_at ?? null}, completed_at)
        WHERE id = ${id}`;
    },

    /** Insert an immutable evaluation receipt (one per run). */
    async insertReceipt(input: ReceiptInput): Promise<ReceiptRow> {
      const rows = await sql<ReceiptRow[]>`
        INSERT INTO evaluation_receipts (
          id, evaluation_run_id, result, result_status, receipt, canonical_hash, signature
        ) VALUES (
          ${input.id}, ${input.evaluation_run_id}, ${input.result}, ${input.result_status},
          ${json(sql, input.receipt)}, ${input.canonical_hash},
          ${input.signature ? json(sql, input.signature) : null}
        )
        RETURNING *`;
      return one(rows, "evaluation_receipt");
    },

    async getReceipt(id: string): Promise<ReceiptRow | null> {
      return maybe(
        await sql<ReceiptRow[]>`SELECT * FROM evaluation_receipts WHERE id = ${id}`,
      );
    },

    async getReceiptByRun(runId: string): Promise<ReceiptRow | null> {
      return maybe(
        await sql<ReceiptRow[]>`
          SELECT * FROM evaluation_receipts WHERE evaluation_run_id = ${runId}`,
      );
    },

    async insertDiscrepancy(input: DiscrepancyInput): Promise<{ id: string }> {
      const inserted = await sql<{ id: string }[]>`
        INSERT INTO discrepancies (
          id, benchmark_reference, commitment_id, subject_id, published_result,
          computed_result, category, summary, details, blocking, resolution_status,
          linked_objects
        ) VALUES (
          ${input.id}, ${input.benchmark_reference}, ${input.commitment_id}, ${input.subject_id},
          ${input.published_result}, ${input.computed_result}, ${input.category},
          ${input.summary}, ${input.details ?? null}, ${input.blocking}, ${input.resolution_status},
          ${json(sql, input.linked_objects ?? {})}
        )
        RETURNING id`;
      return one(inserted, "discrepancy");
    },

    async listOpenDiscrepancies(commitmentId: string, subjectId: string) {
      return sql`
        SELECT * FROM discrepancies
        WHERE commitment_id = ${commitmentId} AND subject_id = ${subjectId}
          AND resolution_status IN ('open', 'under_review')
        ORDER BY created_at DESC`;
    },
  };
}

export type EvaluationsRepository = ReturnType<typeof evaluationsRepository>;
