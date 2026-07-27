"use client";

import { ArrowRight, Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MethodologyView } from "@/components/policy-test/types";

const METHODOLOGY_LABELS = ["Human reviewed", "No numeric score", "Unknown remains unknown"];

function ScopePanel({
  title,
  terms,
  included,
}: {
  title: string;
  terms: string[];
  included: boolean;
}) {
  const Icon = included ? Check : Minus;
  return (
    <div className="tool p-5">
      <h4 className="label">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {terms.map((term) => (
          <li key={term} className="flex items-start gap-2.5 text-[0.9rem] leading-6">
            <Icon
              aria-hidden
              className={`mt-1 size-3.5 shrink-0 ${included ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className={included ? undefined : "text-muted-foreground"}>{term}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PolicyTestMethodology({
  methodology,
  onAdvance,
}: {
  methodology: MethodologyView;
  onAdvance: () => void;
}) {
  return (
    <div>
      <blockquote className="rounded-lg border border-border bg-muted/30 px-5 py-4">
        <p className="text-[0.98rem] leading-7 text-foreground text-pretty">
          {methodology.question}
        </p>
      </blockquote>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ScopePanel title="Included US scope" terms={methodology.includedScope} included />
        <ScopePanel title="Excluded US scope" terms={methodology.excludedScope} included={false} />
      </div>

      <ul className="mt-6 flex flex-wrap gap-2">
        {METHODOLOGY_LABELS.map((label) => (
          <li
            key={label}
            className="rounded-full border border-border px-2.5 py-1 text-[0.78rem] text-muted-foreground"
          >
            {label}
          </li>
        ))}
      </ul>

      <div className="mt-8 border-t border-border pt-6">
        <h4 className="label">Core conduct types</h4>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {methodology.coreConductTypes.map((conduct) => (
            <li
              key={conduct}
              className="rounded-lg border border-border px-3 py-2.5 text-[0.88rem] font-medium"
            >
              {conduct}
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-[68ch] text-[0.88rem] leading-6 text-muted-foreground">
          These conduct types remain separate. Documentation or risk assessment does not
          automatically count as a direct model-evaluation duty.
        </p>
      </div>

      <div className="mt-8">
        <Button size="lg" onClick={onAdvance}>
          Translate into a rule
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
