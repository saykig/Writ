import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * SectionLabel — a restrained tracked-caps eyebrow in the TEXT face (not
 * decorative mono). `seam` prepends a short gold tick; use it only where a
 * section genuinely names a point of judgment, never as a default flourish.
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
    <p className={cn("label flex items-center gap-2", className)}>
      {seam ? <span aria-hidden className="inline-block h-3 w-px shrink-0 bg-gold" /> : null}
      <span>{children}</span>
    </p>
  );
}

/**
 * SectionHeading — display-face (IM Fell English) section heading, `<h2>` by
 * default. Sized on the shared fluid type scale.
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
        "font-display text-[length:var(--t-h2)] leading-[1.1] tracking-[-0.01em] text-balance",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Prose — a measured reading column in the text face (Libre Baskerville), warm
 * soft ink, with restrained gold link styling.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[64ch] text-[length:var(--t-body)] leading-[1.7] text-muted-foreground [text-wrap:pretty]",
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-4 [&_a:hover]:decoration-foreground",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
