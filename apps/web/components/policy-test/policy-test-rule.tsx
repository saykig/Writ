"use client";

import * as React from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceEntry, PolicyTestView, RuleKey } from "@/components/policy-test/types";

const ALL_KEYS: RuleKey[] = ["actor", "conduct", "force", "applicability"];

/**
 * The headline rule, as four conditions you can switch off one at a time.
 *
 * Every value comes from `methodology.headline_rule`, and every count is
 * recomputed over the reviewed claims as conditions are toggled. Relaxing a
 * condition is how the distinctions become visible: drop `binding` and the
 * voluntary US evaluation guidance appears; drop `market provider` and the
 * federal agency duties do. The reviewed result always requires all four, and
 * the panel says so whenever the rule has been changed.
 */
export function PolicyTestRule({
  view,
  onAdvance,
}: {
  view: PolicyTestView;
  onAdvance: () => void;
}) {
  const [active, setActive] = React.useState<RuleKey[]>(ALL_KEYS);
  const modified = active.length !== ALL_KEYS.length;

  // Bundle parents hold no legal force of their own, so only claims are tested.
  const claims = React.useMemo(
    () => view.groups.flatMap((group) => (group.isBundle ? group.children : [group.parent])),
    [view.groups],
  );

  const matches = React.useMemo(
    () =>
      claims.filter((claim) =>
        active.every((key) => claim.checks?.find((check) => check.key === key)?.met),
      ),
    [claims, active],
  );

  // Membership toggles; the canonical order is kept so the label reads the same.
  const toggle = (key: RuleKey) =>
    setActive((keys) =>
      keys.includes(key)
        ? keys.filter((item) => item !== key)
        : ALL_KEYS.filter((item) => keys.includes(item) || item === key),
    );

  const euMatches = matches.filter((claim) => claim.jurisdiction === "EU");
  const usMatches = matches.filter((claim) => claim.jurisdiction === "US");

  return (
    <div>
      <p className="max-w-[64ch] text-[0.95rem] leading-7 text-muted-foreground">
        All four conditions must hold. Switch one off to see what the corpus would return without
        it.
      </p>

      <ul className="mt-6 space-y-2">
        {view.ruleConditions.map((condition) => {
          // `target_class` names the class of model, not a field a claim carries,
          // so it is shown as part of the rule but cannot be switched off.
          if (condition.key === null) {
            return (
              <li
                key={condition.source}
                className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3"
              >
                <span aria-hidden className="size-5 shrink-0" />
                <span className="label w-[5.5rem] shrink-0">{condition.label}</span>
                <span className="min-w-0 flex-1 text-[0.92rem] font-medium break-words">
                  {condition.value}
                </span>
                <span className="shrink-0 text-[0.78rem] text-muted-foreground">scope</span>
              </li>
            );
          }

          const key = condition.key;
          const on = active.includes(key);
          const surviving = claims.filter(
            (claim) => claim.checks?.find((check) => check.key === key)?.met,
          ).length;

          return (
            <li key={condition.source}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(key)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors duration-150 outline-none",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  on
                    ? "border-primary/35 bg-primary/[0.07]"
                    : "border-border bg-transparent opacity-60 hover:opacity-100",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-colors duration-150",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {on ? <Check className="size-3" /> : null}
                </span>

                <span className="label w-[5.5rem] shrink-0">{condition.label}</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-[0.92rem] font-medium break-words",
                    !on && "line-through decoration-muted-foreground/50",
                  )}
                >
                  {condition.value}
                </span>
                <span className="shrink-0 text-[0.78rem] tabular-nums text-muted-foreground">
                  {surviving}/{claims.length}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Live result */}
      <div className="mt-5 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h4 className="label">
            {modified ? "Modified rule — matching claims" : "Reviewed rule — matching claims"}
          </h4>
          {modified ? (
            <Button variant="ghost" size="sm" onClick={() => setActive(ALL_KEYS)}>
              <RotateCcw aria-hidden />
              Reset
            </Button>
          ) : null}
        </div>

        <p aria-live="polite" className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-[1.6rem] leading-none font-semibold tabular-nums">
            {matches.length}
          </span>
          <span className="text-[0.85rem] text-muted-foreground">
            of {claims.length} reviewed claims
          </span>
          <span className="text-[0.85rem] text-muted-foreground tabular-nums">
            EU {euMatches.length} · US {usMatches.length}
          </span>
        </p>

        {matches.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {matches.map((claim) => (
              <li key={claim.id}>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono",
                    claim.jurisdiction === "EU"
                      ? "border-primary/35 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {claim.id}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[0.85rem] text-muted-foreground">
            Nothing in the reviewed corpus meets every condition.
          </p>
        )}

        <p className="mt-4 border-t border-border pt-3 text-[0.82rem] leading-6 text-muted-foreground">
          {modified
            ? "This is an exploration. The reviewed result on the receipt uses all four conditions."
            : "No US claim reaches the second condition: none places a duty on a market provider."}
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

/** Four pips showing which rule conditions a claim meets. */
export function RuleCheckPips({
  checks,
  className,
}: {
  checks: NonNullable<EvidenceEntry["checks"]>;
  className?: string;
}) {
  const met = checks.filter((check) => check.met).length;
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1", className)}
      aria-label={`Meets ${met} of ${checks.length} rule conditions: ${checks
        .map((check) => `${check.label} ${check.met ? "yes" : "no"}`)
        .join(", ")}`}
      role="img"
    >
      {checks.map((check) => (
        <span
          key={check.key}
          title={`${check.label}: ${check.actual ?? "not recorded"}`}
          className={cn(
            "flex size-4 items-center justify-center rounded-[3px] border",
            check.met
              ? "border-primary/45 bg-primary/15 text-primary"
              : "border-border text-muted-foreground/50",
          )}
        >
          {check.met ? (
            <Check aria-hidden className="size-2.5" />
          ) : (
            <X aria-hidden className="size-2.5" />
          )}
        </span>
      ))}
    </span>
  );
}
