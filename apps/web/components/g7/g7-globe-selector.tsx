"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

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
    <div
      className={cn(
        "relative min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,42rem)_15rem] min-[1400px]:items-end min-[1400px]:gap-3",
        className,
      )}
    >
      <WireframeDottedGlobe
        className="mx-auto"
        markers={markers}
        selectedMarkerId={selectedMemberId}
        onMarkerSelect={(markerId) => setSelectedMemberId(markerId as G7MemberId)}
      />

      <div className="relative z-20 mx-auto mt-3 grid max-w-[40rem] items-end gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] min-[1400px]:mx-0 min-[1400px]:mt-0 min-[1400px]:grid-cols-1">
        <label className="block">
          <span className="sr-only">Choose a G7 member assessment</span>
          <select
            value={selectedMemberId ?? ""}
            onChange={(event) => setSelectedMemberId(event.target.value as G7MemberId)}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
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

        <div aria-live="polite">
          {selectedMember ? (
            <aside className="rounded-xl border border-border bg-card/95 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{selectedMember.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedMember.topic} · {selectedMember.year}
                  </p>
                </div>
                <TruthBadge value={selectedMember.publishedResult} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Published result</dt>
                <dd className="text-right">{selectedMember.publishedResult}</dd>
                <dt className="text-muted-foreground">Writ result</dt>
                <dd className="text-right">{selectedMember.writResult}</dd>
                <dt className="text-muted-foreground">Result status</dt>
                <dd className="text-right">{selectedMember.resultStatus}</dd>
                <dt className="text-muted-foreground">Reviewed actions</dt>
                <dd className="text-right">{selectedMember.reviewedActions}</dd>
              </dl>

              <Button
                className="mt-4 min-h-11 w-full text-xs"
                nativeButton={false}
                render={
                  <Link href={`/lab/g7-2025/${selectedMember.id}` as Route}>
                    Open {selectedMember.name}’s assessment
                    <ArrowRight />
                  </Link>
                }
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                View the rules, evidence, and result in Writ Lab.
              </p>
            </aside>
          ) : (
            <p className="rounded-lg bg-background/85 px-3 py-2 text-xs leading-5 text-muted-foreground">
              Select an illuminated marker or choose a member to preview its assessment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
