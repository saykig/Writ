import { CheckCircle2 } from "lucide-react";

import type { EvidenceView } from "@/components/lab/types";
import { HashPill } from "@/components/site/hash-pill";

function day(iso: string): string {
  return iso.slice(0, 10);
}

export function EvidencePanel({ evidence }: { evidence: EvidenceView }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-rule bg-paper-deep/30 p-4">
        <p className="text-sm font-medium text-foreground">Frozen, reviewed evidence</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[0.7rem] text-ink-faint">
          <span>frozen {day(evidence.frozenAt)}</span>
          <span>cutoff {day(evidence.cutoff)}</span>
          <HashPill hash={evidence.contentHash} label="snapshot" chars={10} />
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-foreground">Reviewed provisions</p>
          <span className="font-mono text-[0.7rem] text-ink-faint">{evidence.actions.length}</span>
        </div>
        <ul className="mt-3 space-y-3">
          {evidence.actions.map((action) => (
            <li key={action.id} className="rounded-lg border border-rule p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-true" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <span className="rounded border border-rule px-1.5 py-0.5 font-mono text-[0.68rem] text-ink-soft">
                      {action.badge ?? "unclassified"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[0.68rem] text-ink-faint">
                    {action.detail} · {action.id}
                  </p>
                  {action.passage ? (
                    <blockquote className="mt-3 border-l border-rule pl-3 text-[0.82rem] leading-6 text-ink-soft">
                      {action.passage.quote}
                      {action.passage.page != null ? (
                        <span className="ml-2 font-mono text-[0.68rem] text-ink-faint">
                          p.{action.passage.page}
                        </span>
                      ) : null}
                    </blockquote>
                  ) : null}
                  {action.review ? (
                    <p className="mt-2 font-mono text-[0.68rem] text-ink-faint">
                      {action.review.reviewerId} · {action.review.decision}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
