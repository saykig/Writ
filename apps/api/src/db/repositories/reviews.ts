// Analyst / reviewer decisions. Reviews are superseded, never edited.
import type { DbClient } from "../client.js";
import type { ReviewInput } from "../types.js";
import { maybe, one } from "./shared.js";

export interface ReviewRow {
  id: string;
  object_type: string;
  object_id: string;
  reviewer_id: string;
  decision: string;
  rationale: string;
  conflict_of_interest: string | null;
  supersedes_review_id: string | null;
  created_at: Date;
}

export function reviewsRepository(sql: DbClient) {
  return {
    async insert(input: ReviewInput): Promise<ReviewRow> {
      const rows = await sql<ReviewRow[]>`
        INSERT INTO reviews (
          id, object_type, object_id, reviewer_id, decision, rationale,
          conflict_of_interest, supersedes_review_id, created_at
        ) VALUES (
          ${input.id}, ${input.object_type}, ${input.object_id}, ${input.reviewer_id},
          ${input.decision}, ${input.rationale}, ${input.conflict_of_interest ?? null},
          ${input.supersedes_review_id ?? null}, ${input.created_at}
        )
        RETURNING *`;
      return one(rows, "review");
    },

    async get(id: string): Promise<ReviewRow | null> {
      return maybe(await sql<ReviewRow[]>`SELECT * FROM reviews WHERE id = ${id}`);
    },

    async listForObject(objectType: string, objectId: string): Promise<ReviewRow[]> {
      return sql<ReviewRow[]>`
        SELECT * FROM reviews
        WHERE object_type = ${objectType} AND object_id = ${objectId}
        ORDER BY created_at DESC`;
    },

    async latestForObject(objectType: string, objectId: string): Promise<ReviewRow | null> {
      return maybe(
        await sql<ReviewRow[]>`
          SELECT * FROM reviews
          WHERE object_type = ${objectType} AND object_id = ${objectId}
          ORDER BY created_at DESC
          LIMIT 1`,
      );
    },
  };
}

export type ReviewsRepository = ReturnType<typeof reviewsRepository>;
