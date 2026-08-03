"use client";

/**
 * Which record. Each option describes itself in the record's own terms — actor,
 * conduct, force, applicability — so the choice is legible before it is made,
 * and a record with no traced source says so in the list rather than after.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LabRecordSummary } from "@/lib/record-view";

export function RecordSelector({
  summaries,
  selectedId,
  onSelect,
}: {
  summaries: readonly LabRecordSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = summaries.find((summary) => summary.id === selectedId);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
        Record
      </span>
      <Select value={selectedId} onValueChange={(value) => onSelect(String(value))}>
        <SelectTrigger className="w-[19rem] max-w-full" aria-label="Record">
          <SelectValue>
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="font-mono text-[0.72rem] text-muted-foreground">{selectedId}</span>
              <span className="min-w-0 truncate text-[0.8rem]">
                {selected ? `${selected.instrument}, ${selected.sourceLocator}` : "Select a record"}
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-[26rem]">
          {summaries.map((summary) => (
            <SelectItem key={summary.id} value={summary.id}>
              <span className="flex min-w-0 flex-col gap-0.5 py-0.5">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {summary.id}
                  </span>
                  <span className="text-[0.82rem]">
                    {summary.instrument}, {summary.sourceLocator}
                  </span>
                </span>
                <span className="text-[0.72rem] text-muted-foreground">
                  {summary.summary}
                  {summary.hasSource ? null : " · no source document registered"}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
