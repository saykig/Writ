"use client";

import * as React from "react";
import { ArrowRight, CornerDownRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RuleCheckPips } from "@/components/policy-test/policy-test-rule";
import type { EvidenceEntry, PolicyTestView } from "@/components/policy-test/types";

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

/** The reviewed fields for one record, opened in place rather than in a dialog. */
function EvidenceFields({ entry }: { entry: EvidenceEntry }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
      {entry.fields.map((field) => (
        <React.Fragment key={field.label}>
          <dt className="label pt-0.5 sm:text-right">{field.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-[0.85rem] leading-6 break-words",
              field.value === null && "text-muted-foreground/70",
              field.tone === "unknown" && "font-medium text-unknown",
              field.tone === "mono" && "font-mono text-[0.8rem]",
            )}
          >
            {field.value ?? "Not recorded"}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function RecordItem({
  entry,
  badge,
  tone,
  interpretation,
  isChild = false,
}: {
  entry: EvidenceEntry;
  badge?: string;
  tone?: keyof typeof HIGHLIGHT_TONE;
  interpretation?: string;
  isChild?: boolean;
}) {
  return (
    <AccordionItem value={entry.id} className={cn(isChild && "not-last:border-b-0")}>
      <AccordionTrigger className="gap-3 py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {isChild ? (
              <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/70" />
            ) : null}
            <span className="font-mono text-[0.78rem]">{entry.id}</span>
            <span className="text-[0.78rem] font-normal text-muted-foreground">
              {entry.sourceLocator}
            </span>
            {badge && tone ? (
              <Badge variant="outline" className={cn("shrink-0", HIGHLIGHT_TONE[tone])}>
                {badge}
              </Badge>
            ) : null}
            {entry.checks ? <RuleCheckPips checks={entry.checks} /> : null}
          </span>
          <span className="text-[0.82rem] font-normal text-muted-foreground">{entry.summary}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        {interpretation ? (
          <p className="mb-4 max-w-[72ch] text-[0.86rem] leading-6">{interpretation}</p>
        ) : null}
        <EvidenceFields entry={entry} />
      </AccordionContent>
    </AccordionItem>
  );
}

export function PolicyTestEvidence({
  view,
  onAdvance,
}: {
  view: PolicyTestView;
  onAdvance: () => void;
}) {
  const [filter, setFilter] = React.useState<Filter>("all");

  const entriesById = React.useMemo(() => {
    const index = new Map<string, EvidenceEntry>();
    for (const group of view.groups) {
      index.set(group.parent.id, group.parent);
      for (const child of group.children) index.set(child.id, child);
    }
    return index;
  }, [view.groups]);

  const inFilter = (jurisdiction: string) => filter === "all" || jurisdiction === filter;
  const highlights = view.highlights.filter((highlight) =>
    inFilter(entriesById.get(highlight.id)?.jurisdiction ?? ""),
  );
  const groups = view.groups.filter((group) => inFilter(group.parent.jurisdiction));

  const counts = [
    { label: "Source rows", value: view.summary.parentRowCount },
    { label: "EU rows", value: view.summary.euParentRowCount },
    { label: "US rows", value: view.summary.usParentRowCount },
    { label: "Claims", value: view.summary.normalizedClaimCount },
    { label: "Pending", value: view.summary.pendingReviewCount },
  ];

  return (
    <div>
      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-b border-border pb-6">
        {counts.map((count) => (
          <div key={count.label} className="min-w-0">
            <dt className="label">{count.label}</dt>
            <dd className="mt-1 text-[1.05rem] font-medium tabular-nums">{count.value}</dd>
          </div>
        ))}
      </dl>

      <div role="group" aria-label="Filter by jurisdiction" className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={option.id === filter ? "secondary" : "ghost"}
            aria-pressed={option.id === filter}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <p className="mt-7 label">Records that set the distinctions</p>
      <Accordion className="mt-1">
        {highlights.map((highlight) => {
          const entry = entriesById.get(highlight.id);
          return entry ? (
            <RecordItem
              key={highlight.id}
              entry={entry}
              badge={highlight.badge}
              tone={highlight.tone}
              interpretation={highlight.interpretation}
            />
          ) : null;
        })}
      </Accordion>

      <p className="mt-9 label">
        All reviewed evidence · {groups.length} source {groups.length === 1 ? "row" : "rows"}
      </p>
      <Accordion className="mt-1">
        {groups.map((group) => {
          if (!group.isBundle) return <RecordItem key={group.parent.id} entry={group.parent} />;
          return (
            <AccordionItem key={group.parent.id} value={group.parent.id}>
              <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="font-mono text-[0.78rem]">{group.parent.id}</span>
                    <span className="text-[0.78rem] font-normal text-muted-foreground">
                      {group.parent.sourceLocator}
                    </span>
                  </span>
                  <span className="text-[0.82rem] font-normal text-muted-foreground">
                    {group.parent.summary}
                  </span>
                </span>
              </AccordionTrigger>
              {/* Children stay nested inside the bundle that produced them. */}
              <AccordionContent className="pb-4">
                <Accordion className="border-l border-border pl-3 sm:pl-4">
                  {group.children.map((child) => (
                    <RecordItem key={child.id} entry={child} isChild />
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <div className="mt-9">
        <Button size="lg" onClick={onAdvance}>
          Produce assessment receipt
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
