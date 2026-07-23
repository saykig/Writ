import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SectionLabel — mono uppercase eyebrow set above a heading. `seam` prefixes a
 * short gold kintsugi tick, used where a section names a point of judgment.
 */
export function SectionLabel({
  children,
  className,
  seam = false,
}: {
  children: ReactNode;
  className?: string;
  seam?: boolean;
}) {
  return (
    <p className={cn("label-mono flex items-center gap-2", className)}>
      {seam ? <span aria-hidden className="inline-block h-3 w-px shrink-0 bg-gold" /> : null}
      <span>{children}</span>
    </p>
  );
}

/**
 * SectionHeading — serif display heading for a section (renders `<h2>` by
 * default). Pass `as` for a different level and `className` to resize.
 */
export function SectionHeading({
  children,
  className,
  as: Tag = "h2" as ElementType,
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        "font-serif text-2xl leading-[1.12] tracking-tight text-balance sm:text-3xl",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Prose — a measured serif reading column (muted ink, restrained link styling)
 * for body copy beneath a SectionHeading.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[62ch] text-[1.02rem] leading-relaxed text-ink-soft [text-wrap:pretty]",
        "[&_a]:text-foreground [&_a]:underline [&_a]:decoration-gold/50 [&_a]:underline-offset-4 [&_a:hover]:decoration-gold",
        "[&_strong]:font-medium [&_strong]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
