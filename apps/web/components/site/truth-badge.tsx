import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Values a TruthBadge understands: the three published scores plus `unresolved`
 * (a score gap), and the four truth values of the evaluation lattice.
 */
export type TruthBadgeValue =
  "+1" | "0" | "-1" | "unresolved" | "true" | "false" | "unknown" | "contested";

// Full literal class strings so Tailwind can statically extract them.
const TONE: Record<TruthBadgeValue, string> = {
  "+1": "border-true/35 bg-true/10 text-true",
  "-1": "border-false/35 bg-false/10 text-false",
  "0": "border-border bg-surface-2 text-ink-soft",
  unresolved: "border-gold/45 bg-gold-wash text-gold",
  true: "border-true/35 bg-true/10 text-true",
  false: "border-false/35 bg-false/10 text-false",
  unknown: "border-unknown/40 bg-unknown/10 text-unknown",
  contested: "border-gold/45 bg-gold-wash text-gold",
};

/**
 * TruthBadge — a compact mono chip for a score (`+1`/`0`/`-1`/`unresolved`) or
 * a truth value, tinted by the truth palette. Presentational; override the
 * shown text with `children`.
 */
export function TruthBadge({
  value,
  children,
  className,
}: {
  value: TruthBadgeValue;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 font-mono text-[0.72rem] leading-none tracking-tight tabular-nums",
        TONE[value],
        className,
      )}
    >
      {children ?? value}
    </span>
  );
}
