"use client";

/**
 * What is being read, and how.
 *
 * The corpus is stated rather than chosen: there is one, and a dropdown with a
 * single entry would promise a capability that does not exist. The jurisdiction
 * filter and the record selector are real choices, and the view toggle opens on
 * Guided because the guided reading is the point of the page.
 */

import type { Jurisdiction } from "@/lib/demo-analysis-format";
import type { LabRecordResolution, LabRecordSummary } from "@/lib/record-view";
import { cn } from "@/lib/utils";
import { RecordSelector } from "./record-selector";

export type JurisdictionFilter = "all" | Jurisdiction;

const FILTERS: { id: JurisdictionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "EU", label: "European Union" },
  { id: "US", label: "United States" },
];

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex rounded-md border border-border p-0.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === value}
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-[0.76rem] transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              option.id === value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RecordHeader({
  corpusLabel,
  summaries,
  selectedId,
  jurisdiction,
  view,
  resolution,
  onSelect,
  onJurisdiction,
  onView,
}: {
  corpusLabel: string;
  summaries: readonly LabRecordSummary[];
  selectedId: string;
  jurisdiction: JurisdictionFilter;
  view: "guided" | "code";
  resolution: LabRecordResolution;
  onSelect: (id: string) => void;
  onJurisdiction: (next: JurisdictionFilter) => void;
  onView: (next: "guided" | "code") => void;
}) {
  const visible = summaries.filter(
    (summary) => jurisdiction === "all" || summary.jurisdiction === jurisdiction,
  );

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
          Corpus
        </span>
        <span className="text-[0.86rem]">{corpusLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Jurisdiction"
          value={jurisdiction}
          options={FILTERS}
          onChange={onJurisdiction}
        />
        <RecordSelector summaries={visible} selectedId={selectedId} onSelect={onSelect} />
        <Segmented
          label="View"
          value={view}
          options={[
            { id: "guided" as const, label: "Guided" },
            { id: "code" as const, label: "Code" },
          ]}
          onChange={onView}
        />
      </div>

      {/* A link that nearly worked is answered, not swallowed. */}
      {resolution.requested && resolution.how !== "exact" ? (
        <p className="text-[0.74rem] leading-6 text-muted-foreground">
          {resolution.requested} is not one of the records the Lab carries.{" "}
          {resolution.how === "parent"
            ? `Showing ${resolution.id}, from the same source bundle.`
            : `Showing ${resolution.id}.`}
        </p>
      ) : null}
    </header>
  );
}
