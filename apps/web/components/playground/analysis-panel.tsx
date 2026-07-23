"use client";

import { AlertTriangle, Check, CircleSlash } from "lucide-react";

import { cn } from "@/lib/utils";
import { TruthBadge } from "@/components/site/truth-badge";
import { OverlapDetail, SCORE_RESULTS, WitnessChips } from "./finding-detail";
import type { CompileDiagnostic, Finding } from "./types";

interface FindingKind {
  label: string;
  panel: string;
  Icon: typeof AlertTriangle;
  iconClass: string;
}

function kindOf(finding: Finding): FindingKind {
  switch (finding.code) {
    case "COV-SCORE-GAP":
      return {
        label: "Gap",
        panel: "border-gold/30 bg-gold-wash",
        Icon: CircleSlash,
        iconClass: "text-gold",
      };
    case "COV-SCORE-OVERLAP":
      return {
        label: "Overlap",
        panel: "border-false/25 bg-false/[0.05]",
        Icon: AlertTriangle,
        iconClass: "text-false",
      };
    default:
      return {
        label: finding.severity === "warning" ? "Warning" : "Finding",
        panel: "border-rule bg-paper-deep/30",
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
    <div className={cn("rounded-lg border p-4", kind.panel)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5 shrink-0", kind.iconClass)} aria-hidden />
        <span className="font-mono text-[0.72rem] tracking-tight text-foreground">
          {finding.code}
        </span>
        <span className="ml-auto text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-muted">
          {kind.label}
        </span>
      </div>
      <p className="mt-2.5 text-[0.9rem] leading-relaxed text-ink-soft">{finding.message}</p>

      {finding.witness ? (
        <div className="mt-3">
          <WitnessChips witness={finding.witness} gold={isGap} />
        </div>
      ) : null}
      {isOverlap && finding.context ? (
        <div className="mt-3">
          <OverlapDetail context={finding.context} />
        </div>
      ) : null}

      {isGap ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-ink-soft">
          <span>no rule matches, so it falls to</span>
          <span className="font-mono text-[0.75rem] text-gold">otherwise</span>
          <span>and scores</span>
          <TruthBadge
            value={
              SCORE_RESULTS.has(String(otherwise))
                ? (String(otherwise) as "unresolved")
                : "unresolved"
            }
          />
        </p>
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
 * AnalysisPanel — the live score-analysis detail behind the Analysis tab. Compile
 * errors when the source is broken, a distinct clean state when the score program
 * is total and non-overlapping, or one card per finding (code, message, witness).
 * The headline verdict is hoisted above the workspace; this is the full readout.
 */
export function AnalysisPanel({ errors, findings, compiled }: AnalysisPanelProps) {
  if (errors.length > 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-[0.9rem] text-false">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            The source does not compile. Fix {errors.length} error{errors.length > 1 ? "s" : ""}{" "}
            before the analyzer can run.
          </span>
        </div>
        <ul className="space-y-1.5">
          {errors.map((diagnostic, i) => (
            <li
              key={`${diagnostic.code}-${i}`}
              className="rounded-lg border border-false/25 bg-false/[0.05] px-3 py-2 font-mono text-[0.72rem] leading-relaxed"
            >
              <span className="mr-2 text-ink-faint tabular-nums">
                {diagnostic.span
                  ? `L${diagnostic.span.startLine}:${diagnostic.span.startColumn}`
                  : "—"}
              </span>
              <span className="text-false">{diagnostic.code}</span>
              <span className="text-ink-soft"> {diagnostic.message}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!compiled) {
    return <p className="text-[0.9rem] text-ink-soft">Waiting for a compilable source.</p>;
  }

  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-true/30 bg-true/[0.05] p-4">
        <div className="flex items-center gap-2 text-true">
          <Check className="size-4 shrink-0" aria-hidden />
          <span className="text-[0.9rem] font-medium">Total and non-overlapping.</span>
        </div>
        <p className="mt-2.5 max-w-[58ch] text-[0.9rem] leading-relaxed text-ink-soft">
          The analyzer enumerated the score program&rsquo;s declared input space and found no gaps,
          overlaps, or unreachable rules. Every input state is scored by exactly one rule.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.9rem] text-ink-soft">
        {findings.length} finding{findings.length > 1 ? "s" : ""} in the score program, before any
        evidence.
      </p>
      {findings.map((finding, i) => (
        <FindingCard key={`${finding.code}-${i}`} finding={finding} />
      ))}
    </div>
  );
}
