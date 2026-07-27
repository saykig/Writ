"use client";

import * as React from "react";
import { ArrowRight, ChevronDown, CornerDownRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceEntry, EvidenceGroup, PolicyTestView } from "@/components/policy-test/types";

type Filter = "all" | "EU" | "US";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "EU", label: "European Union" },
  { id: "US", label: "United States" },
];

/** Full literal classes so Tailwind can extract them statically. */
const HIGHLIGHT_TONE = {
  decisive: "border-primary/40 bg-primary/10 text-primary",
  neutral: "border-border bg-muted/50 text-muted-foreground",
} as const;

function SummaryFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-[1.05rem] font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** One reviewed record as a button that opens its detail panel. */
function EvidenceRow({
  entry,
  isChild,
  onOpen,
}: {
  entry: EvidenceEntry;
  isChild?: boolean;
  onOpen: (entry: EvidenceEntry, trigger: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Reviewed record ${entry.id}: ${entry.summary}`}
      onClick={(event) => onOpen(entry, event.currentTarget)}
      className={cn(
        "flex w-full min-w-0 flex-col gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors duration-150 outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        isChild
          ? "border-transparent bg-transparent hover:border-border hover:bg-muted/40"
          : "border-border bg-card/40 hover:border-foreground/25",
      )}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {isChild ? (
          <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/70" />
        ) : null}
        <span className="font-mono text-[0.78rem] font-medium">{entry.id}</span>
        <span className="text-[0.78rem] text-muted-foreground">{entry.sourceLocator}</span>
      </span>
      <span className="min-w-0 text-[0.85rem] leading-6 text-muted-foreground break-words">
        {entry.summary}
      </span>
    </button>
  );
}

export function PolicyTestEvidence({
  view,
  onOpenEntry,
  onAdvance,
}: {
  view: PolicyTestView;
  onOpenEntry: (entry: EvidenceEntry, trigger: HTMLElement) => void;
  onAdvance: () => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [showAll, setShowAll] = React.useState(false);

  const matches = React.useCallback(
    (jurisdiction: string) => filter === "all" || jurisdiction === filter,
    [filter],
  );

  const entriesById = React.useMemo(() => {
    const index = new Map<string, EvidenceEntry>();
    for (const group of view.groups) {
      index.set(group.parent.id, group.parent);
      for (const child of group.children) index.set(child.id, child);
    }
    return index;
  }, [view.groups]);

  const highlights = view.highlights.filter((highlight) => {
    const entry = entriesById.get(highlight.id);
    return entry ? matches(entry.jurisdiction) : false;
  });

  const groups: EvidenceGroup[] = view.groups.filter((group) => matches(group.parent.jurisdiction));

  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-border pb-6 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryFigure label="Reviewed source rows" value={view.summary.parentRowCount} />
        <SummaryFigure label="EU source rows" value={view.summary.euParentRowCount} />
        <SummaryFigure label="US source rows" value={view.summary.usParentRowCount} />
        <SummaryFigure label="Normalized claims" value={view.summary.normalizedClaimCount} />
        <SummaryFigure label="Pending review" value={view.summary.pendingReviewCount} />
      </dl>

      <div
        role="group"
        aria-label="Filter reviewed evidence by jurisdiction"
        className="mt-6 flex flex-wrap gap-2"
      >
        {FILTERS.map((option) => {
          const active = option.id === filter;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.id)}
              className={cn(
                "min-h-9 rounded-lg border px-3 py-1.5 text-[0.82rem] font-medium transition-colors duration-150 outline-none",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                active
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <ul className="mt-6 space-y-2.5">
        {highlights.map((highlight) => {
          const entry = entriesById.get(highlight.id);
          if (!entry) return null;
          return (
            <li key={highlight.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Reviewed record ${highlight.title}`}
                onClick={(event) => onOpenEntry(entry, event.currentTarget)}
                className={cn(
                  "flex w-full min-w-0 flex-col gap-2 rounded-xl border border-border bg-card/40 p-4 text-left sm:p-5",
                  "transition-colors duration-150 outline-none hover:border-foreground/25",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                )}
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="min-w-0 text-[0.92rem] font-semibold break-words">
                    {highlight.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0", HIGHLIGHT_TONE[highlight.tone])}
                  >
                    {highlight.badge}
                  </Badge>
                </span>
                <span className="text-[0.82rem] text-muted-foreground">{highlight.summary}</span>
                <span className="max-w-[72ch] text-[0.88rem] leading-6 text-foreground/80 break-words">
                  {highlight.interpretation}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-border pt-6">
        <Button
          variant="outline"
          size="lg"
          aria-expanded={showAll}
          aria-controls="policy-test-all-evidence"
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? "Hide all reviewed evidence" : "View all reviewed evidence"}
          <ChevronDown
            aria-hidden
            className={cn("transition-transform duration-200", showAll && "rotate-180")}
          />
        </Button>

        <div id="policy-test-all-evidence" hidden={!showAll} className="mt-5">
          <p className="text-[0.85rem] text-muted-foreground">
            {groups.length} reviewed source {groups.length === 1 ? "row" : "rows"}. Derived claims
            stay under the source bundle they came from.
          </p>
          <ul className="mt-4 space-y-2.5">
            {groups.map((group) => (
              <li key={group.parent.id} className="min-w-0">
                <EvidenceRow entry={group.parent} onOpen={onOpenEntry} />
                {group.children.length > 0 ? (
                  <ul className="mt-1 space-y-1 border-l border-border pl-3 sm:pl-4">
                    {group.children.map((child) => (
                      <li key={child.id} className="min-w-0">
                        <EvidenceRow entry={child} isChild onOpen={onOpenEntry} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <Button size="lg" onClick={onAdvance}>
          Produce assessment receipt
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
