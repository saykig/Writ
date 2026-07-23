"use client";

import { cn } from "@/lib/utils";
import { TruthBadge } from "@/components/site/truth-badge";

/** The four score results the analyzer and receipts speak in. */
export const SCORE_RESULTS = new Set(["+1", "0", "-1", "unresolved"]);

/**
 * WitnessChips — a finding's `witness` (a counterexample assignment) as small
 * mono key/value chips. Gold-toned only when it belongs to the score gap, which
 * is the one place a score turns on judgment; neutral otherwise.
 */
export function WitnessChips({ witness, gold = false }: { witness: unknown; gold?: boolean }) {
  if (!witness || typeof witness !== "object") return null;
  const entries = Object.entries(witness as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className={cn(
            "inline-flex items-baseline gap-1.5 rounded-md border px-2 py-1 font-mono text-[0.72rem] leading-none",
            gold ? "border-gold/25 bg-gold-wash" : "border-rule bg-paper-deep/40",
          )}
        >
          <span className="text-ink-faint">{key}</span>
          <span className="tabular-nums text-foreground">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

/** For an OVERLAP finding, the two rule ids and their conflicting results. */
export function OverlapDetail({ context }: { context: Record<string, unknown> }) {
  const ruleIds = Array.isArray(context.ruleIds) ? (context.ruleIds as unknown[]) : [];
  const results = Array.isArray(context.matchedResults)
    ? (context.matchedResults as unknown[])
    : [];
  if (ruleIds.length < 2 || results.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[0.72rem]">
      {[0, 1].map((i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span className="text-foreground/80">{String(ruleIds[i])}</span>
          {SCORE_RESULTS.has(String(results[i])) ? (
            <TruthBadge value={String(results[i]) as "+1" | "0" | "-1" | "unresolved"} />
          ) : (
            <span className="text-ink-soft">{String(results[i])}</span>
          )}
          {i === 0 ? <span className="text-false">≠</span> : null}
        </span>
      ))}
    </div>
  );
}
