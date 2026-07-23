"use client";

import type { CanonicalIr } from "@covenant/domain";

import { CodeArtifact } from "@/components/site/code-artifact";
import { TruthBadge } from "@/components/site/truth-badge";
import { badgeResult } from "./types";

/** A compact key/value row in the IR summary grid. */
function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="label-mono">{k}</dt>
      <dd className="font-mono text-[0.78rem] text-foreground">{v}</dd>
    </div>
  );
}

export interface IrPanelProps {
  ir: CanonicalIr | null;
  schemaValid: boolean;
  hasErrors: boolean;
}

/**
 * IrPanel — the compiled canonical IR. A compact summary header (package, schema
 * validity, commitment and score-rule counts) sits above the score program and
 * the full pretty-printed IR.
 */
export function IrPanel({ ir, schemaValid, hasErrors }: IrPanelProps) {
  if (!ir) {
    return (
      <p className="text-sm text-ink-soft">
        {hasErrors
          ? "No IR — resolve the compile errors first."
          : "Waiting for a compilable source."}
      </p>
    );
  }

  const commitment = ir.commitments[0];
  const rules = commitment?.score_program.rules ?? [];
  const otherwise = commitment?.score_program.otherwise;

  return (
    <div className="space-y-5">
      <dl className="rounded-[3px] border border-border bg-surface-2/30 px-3.5 py-1.5">
        <Kv k="package" v={ir.package.name} />
        <Kv k="version" v={ir.package.version} />
        <Kv k="language" v={ir.language_version} />
        <Kv
          k="schema"
          v={
            schemaValid ? (
              <span className="text-true">valid</span>
            ) : (
              <span className="text-false">invalid</span>
            )
          }
        />
        <Kv k="commitments" v={<span className="tabular-nums">{ir.commitments.length}</span>} />
        <Kv k="score rules" v={<span className="tabular-nums">{rules.length} + otherwise</span>} />
      </dl>

      {commitment ? (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-[0.78rem] text-foreground">{commitment.id}</span>
            <span className="text-sm text-ink-soft">{commitment.title}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {commitment.variables.map((variable) => (
              <span
                key={variable.id}
                className="inline-flex items-baseline gap-1.5 rounded-[3px] border border-border bg-surface-2/40 px-1.5 py-0.5 font-mono text-[0.72rem]"
              >
                <span className="text-foreground/90">{variable.id}</span>
                <span className="text-ink-faint">{variable.type}</span>
              </span>
            ))}
          </div>

          <div className="mt-1 overflow-hidden rounded-[3px] border border-border">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 border-b border-border/60 px-3 py-1.5 font-mono text-[0.72rem] last:border-b-0"
              >
                <TruthBadge value={badgeResult(rule.result)} />
                <span className="text-ink-faint tabular-nums">p{rule.priority}</span>
                <span className="text-foreground/90">{rule.id}</span>
                {rule.intentional_overlap ? (
                  <span className="ml-auto text-gold">intentional overlap</span>
                ) : null}
              </div>
            ))}
            {otherwise ? (
              <div className="flex items-center gap-3 bg-surface-2/40 px-3 py-1.5 font-mono text-[0.72rem]">
                <TruthBadge value={badgeResult(otherwise.result)} />
                <span className="text-ink-faint">—</span>
                <span className="text-foreground/90">otherwise</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="max-h-[440px] overflow-auto rounded-[4px]">
        <CodeArtifact
          label="Canonical IR"
          filename="playground.ir.json"
          code={JSON.stringify(ir, null, 2)}
          showLineNumbers
        />
      </div>
    </div>
  );
}
