"use client";

import { AlertTriangle, Check, CircleSlash } from "lucide-react";

import { cn } from "@/lib/utils";
import { TruthBadge } from "@/components/site/truth-badge";
import type { CompileDiagnostic, Finding } from "./types";

/** Render a finding's `witness` (a counterexample assignment) as mono chips. */
function WitnessChips({ witness }: { witness: unknown }) {
  if (!witness || typeof witness !== "object") return null;
  const entries = Object.entries(witness as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-baseline gap-1.5 rounded-[3px] border border-gold/30 bg-gold-wash px-1.5 py-0.5 font-mono text-[0.72rem] leading-none"
        >
          <span className="text-ink-faint">{key}</span>
          <span className="tabular-nums text-foreground">{String(value)}</span>
        </span>
      ))}
    </div>
  );
}

const SCORE_RESULTS = new Set(["+1", "0", "-1", "unresolved"]);

/** For an OVERLAP finding, the two rule ids and their conflicting results. */
function OverlapDetail({ context }: { context: Record<string, unknown> }) {
  const ruleIds = Array.isArray(context.ruleIds) ? (context.ruleIds as unknown[]) : [];
  const results = Array.isArray(context.matchedResults)
    ? (context.matchedResults as unknown[])
    : [];
  if (ruleIds.length < 2 || results.length < 2) return null;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[0.72rem]">
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

interface FindingKind {
  label: string;
  accent: string;
  Icon: typeof AlertTriangle;
  iconClass: string;
}

function kindOf(finding: Finding): FindingKind {
  switch (finding.code) {
    case "COV-SCORE-GAP":
      return { label: "Gap", accent: "border-l-gold", Icon: CircleSlash, iconClass: "text-gold" };
    case "COV-SCORE-OVERLAP":
      return {
        label: "Overlap",
        accent: "border-l-false/60",
        Icon: AlertTriangle,
        iconClass: "text-false",
      };
    default:
      return {
        label: finding.severity === "warning" ? "Warning" : "Finding",
        accent: "border-l-unknown/60",
        Icon: AlertTriangle,
        iconClass: "text-ink-soft",
      };
  }
}

function FindingCard({ finding }: { finding: Finding }) {
  const kind = kindOf(finding);
  const { Icon } = kind;
  const isGap = finding.code === "COV-SCORE-GAP";
  const isOverlap = finding.code === "COV-SCORE-OVERLAP";
  const otherwise = isGap ? finding.context?.otherwise : undefined;

  return (
    <div
      className={cn(
        "rounded-[3px] border border-border border-l-2 bg-surface-2/30 p-3.5",
        kind.accent,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5 shrink-0", kind.iconClass)} aria-hidden />
        <span className="font-mono text-[0.72rem] tracking-tight text-foreground">
          {finding.code}
        </span>
        <span className="label-mono ml-auto">{kind.label}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{finding.message}</p>

      <WitnessChips witness={finding.witness} />
      {isOverlap && finding.context ? <OverlapDetail context={finding.context} /> : null}

      {isGap ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.78rem] text-ink-soft">
          <span>no rule matches → </span>
          <TruthBadge
            value={
              SCORE_RESULTS.has(String(otherwise))
                ? (String(otherwise) as "unresolved")
                : "unresolved"
            }
          />
          <span className="text-ink-faint">· marked on the</span>
          <span className="font-mono text-[0.72rem] text-gold">otherwise</span>
          <span className="text-ink-faint">line</span>
        </div>
      ) : null}
    </div>
  );
}

export interface AnalysisPanelProps {
  errors: CompileDiagnostic[];
  findings: Finding[];
  compiled: boolean;
}

/**
 * AnalysisPanel — the score-analysis verdict. Shows compile errors when the
 * source is broken, a distinct "clean" state when the score program is total and
 * non-overlapping, or one card per finding (code, message, witness) otherwise.
 */
export function AnalysisPanel({ errors, findings, compiled }: AnalysisPanelProps) {
  if (errors.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-false">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            Source does not compile — {errors.length} error{errors.length > 1 ? "s" : ""}. Fix these
            before the analyzer can run.
          </span>
        </div>
        <ul className="space-y-1.5">
          {errors.map((diagnostic, i) => (
            <li
              key={`${diagnostic.code}-${i}`}
              className="rounded-[3px] border border-false/25 bg-false/[0.06] px-3 py-2 font-mono text-[0.72rem] leading-relaxed"
            >
              <span className="mr-2 text-ink-faint tabular-nums">
                {diagnostic.span
                  ? `L${diagnostic.span.startLine}:${diagnostic.span.startColumn}`
                  : "—"}
              </span>
              <span className="text-false">{diagnostic.code}</span>
              <span className="text-ink-soft"> — {diagnostic.message}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!compiled) {
    return <p className="text-sm text-ink-soft">Waiting for a compilable source.</p>;
  }

  if (findings.length === 0) {
    return (
      <div className="rounded-[3px] border border-true/30 bg-true/[0.06] p-4">
        <div className="flex items-center gap-2 text-true">
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="text-sm font-medium">Total and non-overlapping.</span>
        </div>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-soft">
          The static analyzer enumerated the score program&rsquo;s declared input space and found no
          gaps, overlaps, or unreachable rules. Every input state is scored by exactly one rule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <span aria-hidden className="inline-block h-3 w-px shrink-0 bg-gold" />
        <span>
          {findings.length} finding{findings.length > 1 ? "s" : ""} in the score program, before any
          evidence.
        </span>
      </div>
      {findings.map((finding, i) => (
        <FindingCard key={`${finding.code}-${i}`} finding={finding} />
      ))}
    </div>
  );
}
