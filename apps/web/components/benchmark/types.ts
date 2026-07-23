/**
 * View models for the 2025 G7 AI-for-SMEs benchmark route.
 *
 * These are shaped in the Server Component (`app/benchmark/page.tsx`) from the
 * real toolchain — `benchmark()`, `benchmarkLedger()`, `memberSnapshot()`, and
 * two `evaluateMember()` receipts per member — and handed to the client matrix
 * as plain JSON. Nothing is recomputed on the client; it only renders.
 */

import type { TruthBadgeValue } from "@/components/site/truth-badge";

/** A published/computed score value the matrix renders as a TruthBadge. */
export type Score = Extract<TruthBadgeValue, "+1" | "0" | "-1" | "unresolved">;

/** One relevant action inside a member's frozen snapshot, with its full chain. */
export interface ActionView {
  readonly id: string;
  readonly label: string;
  readonly jurisdiction: string;
  readonly kind: string;
  readonly implementationStage: string;
  readonly attribution: string;
  readonly targeting: string;
  /** The published-reading classification (`claim.object`). */
  readonly classification: "strong" | "weak" | (string & {});
  /** True when the action carries the `interpretation:general-ai-measure` dimension. */
  readonly sensitive: boolean;
  readonly claim: {
    readonly id: string;
    readonly predicate: string;
    readonly object: string;
    readonly truthValue: string;
    readonly status: string;
  };
  readonly passage: {
    readonly page: number | null;
    readonly quote: string;
    readonly anchorHash: string;
    readonly documentUri?: string;
  };
  readonly review: {
    readonly reviewerId: string;
    readonly decision: string;
    readonly rationale: string;
  };
}

/** One member row: its scores across readings, the counts that drive them, and its evidence. */
export interface MemberView {
  readonly id: string;
  readonly label: string;
  readonly published: Score;
  readonly computed: Score;
  readonly generous: Score;
  readonly match: boolean;
  readonly flips: boolean;
  readonly sensitive: boolean;
  /** Distinct qualifying actions classified `strong` under the published reading. */
  readonly strongCount: number;
  readonly weakCount: number;
  /** Qualifying actions carrying the general-AI-measure dimension (all weak when published). */
  readonly sensitiveCount: number;
  /** Strong count once the sensitive actions are read as strong. */
  readonly generousStrongCount: number;
  /** All distinct actions that entered the score. */
  readonly qualifyingCount: number;
  /** The interpretation-sensitivity note from the ledger. */
  readonly note: string;
  /** The per-cell note from the ledger. */
  readonly cellNote: string;
  readonly snapshot: {
    readonly id: string;
    readonly frozenAt: string;
    readonly cutoff: string;
    readonly contentHash: string;
  };
  readonly publishedHash: string;
  readonly generousHash: string;
  readonly publishedRule: string;
  readonly generousRule: string;
  readonly resultStatus: string;
  readonly actions: readonly ActionView[];
}
