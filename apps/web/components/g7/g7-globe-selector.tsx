"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, XIcon } from "lucide-react";

import type { G7AssessmentPreview, G7MemberId } from "@/components/g7/types";
import { TruthBadge } from "@/components/site/truth-badge";
import { Button } from "@/components/ui/button";
import { WireframeDottedGlobe } from "@/components/ui/wireframe-dotted-globe";
import { cn } from "@/lib/utils";

const MARKER_DISPLAY_OFFSETS: Record<G7MemberId, readonly [number, number]> = {
  canada: [0, 0],
  france: [-40, -15],
  germany: [42, -38],
  italy: [8, 55],
  japan: [0, 0],
  united_kingdom: [-15, -62],
  united_states: [0, 0],
  european_union: [48, 18],
};

export function G7GlobeSelector({
  members,
  className,
}: {
  members: readonly G7AssessmentPreview[];
  className?: string;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<G7MemberId | null>(null);
  const markers = useMemo(
    () =>
      members.map((member) => ({
        id: member.id,
        label: member.name,
        coordinates: member.markerCoordinates,
        displayOffset: MARKER_DISPLAY_OFFSETS[member.id],
      })),
    [members],
  );
  const selectedMember = members.find((member) => member.id === selectedMemberId);

  return (
    <div className={cn("relative min-w-0 max-w-full", className)}>
      <WireframeDottedGlobe
        className="mx-auto"
        markers={markers}
        selectedMarkerId={selectedMemberId}
        onMarkerSelect={(markerId) => setSelectedMemberId(markerId as G7MemberId)}
      />

      {/* The detail panel has its own permanently reserved slot beneath the globe.
          Reserving it means selecting a member never reflows the page — the globe
          does not move under the pointer — and the panel never covers the map. */}
      <div
        className="mt-4 flex min-h-[15rem] w-full min-w-0 justify-center px-2"
        aria-live="polite"
      >
        {selectedMember ? (
          <aside
            key={selectedMember.id}
            className="w-full max-w-[21rem] self-start rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
          >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{selectedMember.name}</p>
                  <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                    {selectedMember.topic} · {selectedMember.year}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <TruthBadge value={selectedMember.publishedResult} />
                  <button
                    type="button"
                    onClick={() => setSelectedMemberId(null)}
                    aria-label="Close assessment preview"
                    className="-mr-1 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.7rem]">
                <dt className="text-muted-foreground">Published result</dt>
                <dd className="text-right tabular-nums">{selectedMember.publishedResult}</dd>
                <dt className="text-muted-foreground">Writ result</dt>
                <dd className="text-right tabular-nums">{selectedMember.writResult}</dd>
                <dt className="text-muted-foreground">Result status</dt>
                <dd className="text-right">{selectedMember.resultStatus}</dd>
                <dt className="text-muted-foreground">Reviewed actions</dt>
                <dd className="text-right tabular-nums">{selectedMember.reviewedActions}</dd>
              </dl>

              <Button
                className="mt-3 min-h-9 w-full text-[0.72rem]"
                nativeButton={false}
                render={
                  <Link href={`/lab/g7-2025/${selectedMember.id}` as Route}>
                    Open {selectedMember.name}’s assessment
                    <ArrowRight />
                  </Link>
                }
              />
              <p className="mt-1.5 text-center text-[0.68rem] leading-4 text-muted-foreground">
                View the rules, evidence, and result in Writ Lab.
              </p>
          </aside>
        ) : (
          <p className="max-w-[30ch] self-start pt-2 text-center text-xs leading-5 whitespace-normal text-muted-foreground">
            Select an illuminated marker to preview its assessment.
          </p>
        )}
      </div>

      {/* The globe itself is the selector, so no visible dropdown duplicates it.
          Markers are pointer-only (tabIndex -1) and the ones facing away are
          hidden, so this control stays in the tab order as the keyboard and
          screen-reader path; it reveals itself when focused. */}
      <label className="sr-only block focus-within:not-sr-only">
        <span className="sr-only">Choose a G7 member assessment</span>
        <select
          value={selectedMemberId ?? ""}
          onChange={(event) => setSelectedMemberId(event.target.value as G7MemberId)}
          className="h-9 w-auto max-w-full rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="" disabled>
            Choose a member
          </option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
