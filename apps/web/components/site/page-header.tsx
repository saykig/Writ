import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleClassName,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  return (
    <header className={cn("border-b border-border", className)}>
      <div className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1
          className={cn(
            "mt-4 max-w-[18ch] text-[length:var(--t-page)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-[68ch] text-base leading-7 text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
        {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}
