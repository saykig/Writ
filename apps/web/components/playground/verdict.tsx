"use client";

import { cn } from "@/lib/utils";
import { TruthBadge } from "@/components/site/truth-badge";
import { OverlapDetail, SCORE_RESULTS, WitnessChips } from "./finding-detail";
import type { CompileDiagnostic, Finding } from "./types";

type Tone = "gold" | "false" | "true" | "muted";

const PANEL_TONE: Record<Tone, string> = {
  gold: "border-gold/30 bg-gold-wash",
  false: "border-false/25 bg-false/[0.05]",
  true: "border-true/30 bg-true/[0.05]",
  muted: "border-rule bg-paper-deep/30",
};

const LABEL_TONE: Record<Tone, string> = {
  gold: "text-gold",
  false: "text-false",
  true: "text-true",
  muted: "text-ink-muted",
};

const DOT_TONE: Record<Tone, string> = {
  gold: "bg-gold",
  false: "bg-false",
  true: "bg-true",
  muted: "bg-ink-faint/50",
};

interface Shape {
  tone: Tone;
  eyebrow: string;
  headline: string;
}

/** Distil the live analyzer state into one plain verdict shape. */
function shapeOf(
  compiled: boolean,
  errors: CompileDiagnostic[],
  findings: Finding[],
  gap: Finding | null,
  overlap: Finding | null,
): Shape | null {
  if (errors.length > 0) {
    return {
      tone: "false",
      eyebrow: "Does not compile",
      headline:
        errors.length > 1
          ? `The source has ${errors.length} compile errors.`
          : "The source has a compile error.",
    };
  }
  if (!compiled) return null;
  if (gap) {
    return { tone: "gold", eyebrow: "Uncovered region", headline: "One state goes unscored." };
  }
  if (overlap) {
    return { tone: "false", eyebrow: "Overlap", headline: "Two rules score one state." };
  }
  if (findings.length > 0) {
    return {
      tone: "muted",
      eyebrow: "Findings",
      headline: `${findings.length} finding${findings.length > 1 ? "s" : ""} in the score program.`,
    };
  }
  return {
    tone: "true",
    eyebrow: "Total and non-overlapping",
    headline: "Every state is scored exactly once.",
  };
}

/**
 * VerdictInline — the same live analysis distilled to a single line, for the
 * tool-first toolbar: a tone dot, the outcome, its plain headline, and a live pip.
 */
export function VerdictInline({
  analyzing,
  compiled,
  errors,
  findings,
  gap,
}: {
  analyzing: boolean;
  compiled: boolean;
  errors: CompileDiagnostic[];
  findings: Finding[];
  gap: Finding | null;
}) {
  const overlap = findings.find((f) => f.code === "WRT-SCORE-OVERLAP") ?? null;
  const shape = shapeOf(compiled, errors, findings, gap, overlap);
  if (!shape) {
    return (
      <span className="flex items-center gap-2 text-[0.82rem] text-ink-muted">
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ink-faint/60" />
        Reading the score program…
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2 text-[0.85rem]">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT_TONE[shape.tone])} />
      <span className={cn("font-medium whitespace-nowrap", LABEL_TONE[shape.tone])}>
        {shape.eyebrow}
      </span>
      <span aria-hidden className="text-ink-faint">
        ·
      </span>
      <span className="truncate text-foreground">{shape.headline}</span>
      <span
        aria-hidden
        className={cn(
          "ml-0.5 size-1.5 shrink-0 rounded-full",
          analyzing ? "animate-pulse bg-ink-faint/60" : "bg-true/70",
        )}
      />
    </span>
  );
}

export interface VerdictProps {
  analyzing: boolean;
  compiled: boolean;
  errors: CompileDiagnostic[];
  findings: Finding[];
  gap: Finding | null;
  /** The selected reading's framing, or null once the source has been edited. */
  note: string | null;
}

/**
 * Verdict — the result-first headline. Reads the same live analysis state that
 * drives the editor and renders it plainly: the outcome, the reading's framing,
 * and the concrete evidence (the gap's witness, the overlap's rules). Gold marks
 * the one place a score turns on judgment: the score gap.
 */
export function Verdict({ analyzing, compiled, errors, findings, gap, note }: VerdictProps) {
  const overlap = findings.find((f) => f.code === "WRT-SCORE-OVERLAP") ?? null;
  const shape = shapeOf(compiled, errors, findings, gap, overlap);

  if (!shape) {
    return (
      <div className="rounded-xl border border-rule bg-paper-deep/30 p-6 sm:p-7">
        <div className="flex items-center gap-2 text-ink-muted">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ink-faint/50" />
          <span className="text-[0.86rem]">Reading the score program…</span>
        </div>
        <div className="mt-4 space-y-2" aria-hidden>
          <div className="h-3 w-2/3 animate-pulse rounded bg-paper-sink/70" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-paper-sink/50" />
        </div>
      </div>
    );
  }

  const { tone } = shape;
  const otherwise = gap ? gap.context?.otherwise : undefined;

  return (
    <div className={cn("rounded-xl border p-6 sm:p-7", PANEL_TONE[tone])}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT_TONE[tone])} />
        <span
          className={cn("text-[0.72rem] font-bold uppercase tracking-[0.14em]", LABEL_TONE[tone])}
        >
          {shape.eyebrow}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[0.72rem] text-ink-faint">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              analyzing ? "animate-pulse bg-ink-faint/60" : "bg-true/70",
            )}
          />
          live
        </span>
      </div>

      <p className="mt-3 font-display text-[length:var(--t-h3)] leading-[1.15] tracking-[-0.01em] text-foreground text-balance">
        {shape.headline}
      </p>

      {note ? (
        <p className="mt-3 max-w-[58ch] text-[0.95rem] leading-[1.65] text-ink-soft [text-wrap:pretty]">
          {note}
        </p>
      ) : null}

      {gap ? (
        <div className="mt-5 space-y-3">
          <WitnessChips witness={gap.witness} gold />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem] text-ink-soft">
            <span>No rule matches, so it falls to</span>
            <span className="font-mono text-[0.78rem] text-gold">otherwise</span>
            <span>and scores</span>
            <TruthBadge
              value={
                SCORE_RESULTS.has(String(otherwise))
                  ? (String(otherwise) as "unresolved")
                  : "unresolved"
              }
            />
          </p>
        </div>
      ) : null}

      {overlap && !gap && overlap.context ? (
        <div className="mt-5">
          <OverlapDetail context={overlap.context} />
        </div>
      ) : null}

      {gap || overlap ? (
        <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule/60 pt-3.5 text-[0.78rem] text-ink-faint">
          <span className={cn("font-mono", gap ? "text-gold" : "text-ink-muted")}>
            {gap ? gap.code : overlap?.code}
          </span>
          <span>proved before any evidence exists.</span>
        </p>
      ) : (
        <p className="mt-5 border-t border-rule/60 pt-3.5 text-[0.78rem] text-ink-faint">
          {errors.length > 0
            ? "Fix the source before the analyzer can run."
            : "Proved by enumerating the declared input space, before any evidence exists."}
        </p>
      )}
    </div>
  );
}
