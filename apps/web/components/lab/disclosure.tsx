"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Disclosure — a quiet native `<details>` styled to the paper system. Heavy
 * receipt and IR detail (proof trees, hash rows, raw JSON) lives behind these so
 * the panel reads as a result first and a wall never. The marker rotates on open;
 * `prefers-reduced-motion` collapses the transition globally.
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
  onToggle,
  className,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Fires with the new state. Lets a caller defer mounting heavy children. */
  onToggle?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      onToggle={
        onToggle ? (event) => onToggle((event.currentTarget as HTMLDetailsElement).open) : undefined
      }
      className={cn("group border-t border-rule/70 first:border-t-0", className)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 py-3 text-[0.86rem] text-ink-soft transition-colors marker:hidden hover:text-foreground focus-visible:outline-none focus-visible:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-ink-faint transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="font-medium">{summary}</span>
        {meta ? (
          <span className="ml-auto text-[0.75rem] text-ink-faint tabular-nums">{meta}</span>
        ) : null}
      </summary>
      <div className="pb-4 pl-[1.375rem]">{children}</div>
    </details>
  );
}
