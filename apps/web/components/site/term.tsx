"use client";

import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Term — an inline glossary term. Hover or focus reveals a one-line definition,
 * so jargon (IR, contested, four-valued truth) stays readable without a detour.
 */
export function Term({ children, definition }: { children: ReactNode; definition: string }) {
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 outline-none transition-colors hover:decoration-foreground focus-visible:decoration-foreground"
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-[0.78rem] leading-relaxed">
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
