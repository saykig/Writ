import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Stat — a figure block for the figures band: a large serif value over a mono
 * label, with optional sub-note. `tone="gold"` marks a figure that turns on
 * judgment (e.g. the interpretation-sensitive cells).
 */
export function Stat({
  value,
  label,
  sub,
  tone = "default",
  className,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  tone?: "default" | "gold";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "font-serif text-4xl leading-none tracking-tight tabular-nums sm:text-5xl",
          tone === "gold" ? "text-gold" : "text-foreground",
        )}
      >
        {value}
      </div>
      <div className="label-mono">{label}</div>
      {sub ? <div className="max-w-[26ch] text-sm leading-snug text-ink-soft">{sub}</div> : null}
    </div>
  );
}
