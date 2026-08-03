/**
 * Whether the record holds together, in plain language.
 *
 * Seven conditions, always in the same order, each reported as a state rather
 * than a pass. `unknown` takes the reserved colour because it is a judgment;
 * `not recorded` stays muted because an unfilled field is not a failed test, and
 * colouring it red would push a reviewer to fill it in with a guess.
 *
 * Shared with the Builder, where most states are `not recorded` on a fresh draft
 * — which is the lesson, not an error.
 */

import type { CheckState, RecordCheck } from "@/lib/record-checks";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<CheckState, string> = {
  recorded: "text-true",
  inherited: "text-muted-foreground",
  recorded_unknown: "text-unknown",
  not_recorded: "text-muted-foreground",
};

const STATE_DOT: Record<CheckState, string> = {
  recorded: "bg-true",
  inherited: "bg-muted-foreground/50",
  recorded_unknown: "bg-unknown",
  not_recorded: "bg-muted-foreground/30",
};

const STATE_FALLBACK: Record<CheckState, string> = {
  recorded: "Recorded",
  inherited: "Inherited",
  recorded_unknown: "unknown",
  not_recorded: "Not recorded",
};

export function RecordStatus({
  checks,
  summary,
  heading = "Record status",
  className,
}: {
  checks: readonly RecordCheck[];
  summary: string;
  heading?: string;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
          {heading}
        </h3>
        <p className="mt-1 text-[0.82rem] leading-6 text-foreground/85">{summary}</p>
      </div>
      <ul className="divide-y divide-border/50 border-y border-border/50">
        {checks.map((check) => (
          <li key={check.key} className="flex gap-3 py-2">
            <span
              aria-hidden
              className={cn("mt-[0.45rem] size-1.5 shrink-0 rounded-full", STATE_DOT[check.state])}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[0.8rem] leading-6">
                <span className="text-muted-foreground">{check.label}</span>
                <span className={STATE_TONE[check.state]}>
                  {check.value ?? STATE_FALLBACK[check.state]}
                </span>
              </p>
              {check.note ? (
                <p className="text-[0.74rem] leading-6 text-muted-foreground">{check.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
