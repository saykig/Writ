"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { STAGES, type StageId } from "@/components/policy-test/types";

/**
 * The four-stage navigation.
 *
 * A tablist of real buttons: arrow keys move between stages, Home and End jump
 * to the ends, and only the selected stage is in the tab order, so the group is
 * a single tab stop. Vertical on desktop, wrapping on narrow screens, and never
 * a horizontally scrolling strip.
 */
export function PolicyTestStepper({
  stage,
  onSelect,
  panelId,
}: {
  stage: StageId;
  onSelect: (next: StageId) => void;
  panelId: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = STAGES.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    if (next === null) return;
    event.preventDefault();
    onSelect(STAGES[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      aria-label="Policy test stages"
      className="flex flex-col gap-1"
    >
      {STAGES.map((item, index) => {
        const selected = item.id === stage;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`policy-test-stage-${item.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "group/stage flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
              "transition-colors duration-150 outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.7rem] font-semibold tabular-nums transition-colors duration-150",
                selected
                  ? "border-primary/45 bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground group-hover/stage:text-foreground",
              )}
            >
              {index + 1}
            </span>
            <span className="min-w-0 text-[0.9rem] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
