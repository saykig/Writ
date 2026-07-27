"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RuleCondition } from "@/lib/policy-test";

/**
 * The headline rule, as five conditions that must all hold.
 *
 * Every value is read from `methodology.headline_rule` in the reviewed file, so
 * the rule the interface shows and the rule the reviewers wrote cannot drift
 * apart.
 */
export function PolicyTestRule({
  conditions,
  onAdvance,
}: {
  conditions: RuleCondition[];
  onAdvance: () => void;
}) {
  return (
    <div>
      <p className="max-w-[68ch] text-[0.95rem] leading-7 text-muted-foreground">
        All required conditions must be satisfied by reviewed evidence.
      </p>

      <ol className="mt-6 space-y-2">
        {conditions.map((condition, index) => (
          <li
            key={condition.source}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card/40 px-4 py-3.5 sm:flex-row sm:items-baseline sm:gap-5"
          >
            <span className="flex items-center gap-2.5 sm:w-[10rem] sm:shrink-0">
              <span
                aria-hidden
                className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/70"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="label">{condition.label}</span>
            </span>
            <span className="min-w-0 text-[0.95rem] font-medium break-words">
              {condition.value}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-3">
        <p className="max-w-[70ch] text-[0.88rem] leading-6 text-muted-foreground">
          Voluntary evaluation guidance, proposed rules, government-use requirements and
          government-procurement duties remain visible, but they do not independently satisfy this
          headline rule.
        </p>
        <p className="max-w-[70ch] text-[0.88rem] leading-6 text-muted-foreground">
          Evaluation documentation and risk assessment may support the judgment, but they remain
          legally distinct from a direct model-evaluation obligation.
        </p>
      </div>

      <div className="mt-8">
        <Button size="lg" onClick={onAdvance}>
          Run against reviewed evidence
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
