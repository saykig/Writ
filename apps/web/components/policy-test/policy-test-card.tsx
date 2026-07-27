import type { ComponentProps } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface PolicyTestCardMeta {
  label: string;
  value: string;
}

/**
 * The one available policy test, as a single large entry point.
 *
 * The whole card is the target: a stretched link covers it, so there is exactly
 * one tab stop and no nested interactive elements. Hover and focus are carried
 * by the card border and the action row, and the focus ring is driven by
 * `:has(:focus-visible)` so it appears for keyboard users only.
 */
export function PolicyTestCard({
  href,
  badge,
  jurisdiction,
  title,
  description,
  meta,
  action,
  className,
}: {
  href: ComponentProps<typeof Link>["href"];
  badge: string;
  jurisdiction: string;
  title: string;
  description: string;
  meta: readonly PolicyTestCardMeta[];
  action: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "tool group relative isolate overflow-hidden p-6 sm:p-8",
        "transition-colors duration-200 hover:border-foreground/25",
        "has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge
          variant="outline"
          className="label border-primary/35 bg-primary/10 px-2.5 text-primary"
        >
          {badge}
        </Badge>
        <span className="label">{jurisdiction}</span>
      </div>

      <h3 className="mt-6 max-w-[22ch] text-[length:var(--t-h3)] leading-[1.15] font-semibold tracking-[-0.015em]">
        {title}
      </h3>

      <p className="mt-4 max-w-[62ch] text-[0.94rem] leading-7 text-muted-foreground text-pretty">
        {description}
      </p>

      <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-border pt-6 sm:grid-cols-3">
        {meta.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="label">{item.label}</dt>
            <dd className="mt-1.5 text-[0.95rem] font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 flex items-center gap-1.5 text-[0.85rem] font-medium text-primary">
        <Link
          href={href}
          className="rounded-sm outline-none after:absolute after:inset-0 after:content-['']"
        >
          {action}
        </Link>
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </p>
    </article>
  );
}
