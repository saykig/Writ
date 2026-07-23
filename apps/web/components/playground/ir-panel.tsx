"use client";

import type { CanonicalIr } from "@writ/domain";

import { CodeArtifact } from "@/components/site/code-artifact";
import { TruthBadge } from "@/components/site/truth-badge";
import { Disclosure } from "./disclosure";
import { badgeResult } from "./types";

/** A compact key/value row in the IR summary. */
function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-rule/60 py-2 last:border-b-0">
      <dt className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink-muted">{k}</dt>
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
 * IrPanel — the compiled canonical IR. A hairline summary (package, schema
 * validity, rule counts), the score program as a flat table, and the full
 * pretty-printed IR tucked behind a disclosure so the panel reads calm.
 */
export function IrPanel({ ir, schemaValid, hasErrors }: IrPanelProps) {
  if (!ir) {
    return (
      <p className="text-[0.9rem] text-ink-soft">
        {hasErrors
          ? "No IR. Resolve the compile errors first."
          : "Waiting for a compilable source."}
      </p>
    );
  }

  const commitment = ir.commitments[0];
  const rules = commitment?.score_program.rules ?? [];
  const otherwise = commitment?.score_program.otherwise;

  return (
    <div className="space-y-6">
      <dl>
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-[0.78rem] text-foreground">{commitment.id}</span>
            <span className="text-[0.9rem] text-ink-soft">{commitment.title}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {commitment.variables.map((variable) => (
              <span
                key={variable.id}
                className="inline-flex items-baseline gap-1.5 rounded-md border border-rule bg-paper-deep/40 px-2 py-1 font-mono text-[0.72rem]"
              >
                <span className="text-foreground/90">{variable.id}</span>
                <span className="text-ink-faint">{variable.type}</span>
              </span>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-rule">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center gap-3 border-b border-rule/60 px-3 py-2 font-mono text-[0.72rem] last:border-b-0"
              >
                <TruthBadge value={badgeResult(rule.result)} />
                <span className="text-ink-faint tabular-nums">p{rule.priority}</span>
                <span className="text-foreground/90">{rule.id}</span>
                {rule.intentional_overlap ? (
                  <span className="ml-auto text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink-muted">
                    intentional overlap
                  </span>
                ) : null}
              </div>
            ))}
            {otherwise ? (
              <div className="flex items-center gap-3 bg-paper-deep/40 px-3 py-2 font-mono text-[0.72rem]">
                <TruthBadge value={badgeResult(otherwise.result)} />
                <span className="text-ink-faint">—</span>
                <span className="text-foreground/90">otherwise</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="-mb-2">
        <Disclosure summary="Full canonical IR" meta="JSON">
          <div className="max-h-[420px] overflow-auto rounded-lg">
            <CodeArtifact
              label="Canonical IR"
              filename="playground.ir.json"
              code={JSON.stringify(ir, null, 2)}
              showLineNumbers
            />
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
