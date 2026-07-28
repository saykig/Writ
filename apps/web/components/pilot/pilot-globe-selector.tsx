"use client";

/**
 * The homepage globe, showing the two jurisdictions the pilot covers.
 *
 * Selecting one gives its answer to the pilot's question, the provisions behind
 * it, and how much of the reviewed corpus the answer was computed over. Every
 * figure comes from the receipt the evaluator produced.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, XIcon } from "lucide-react";

import type { JurisdictionId, PilotPreview } from "@/lib/pilot-assessments";
import { TruthBadge } from "@/components/site/truth-badge";
import { Button } from "@/components/ui/button";
import { WireframeDottedGlobe } from "@/components/ui/wireframe-dotted-globe";
import { cn } from "@/lib/utils";

/** Nudges the two labels clear of the globe's edge at the projected latitude. */
const MARKER_DISPLAY_OFFSETS: Record<JurisdictionId, readonly [number, number]> = {
  eu: [48, 18],
  us: [0, 0],
};

export function PilotGlobeSelector({
  jurisdictions,
  question,
  className,
}: {
  jurisdictions: readonly PilotPreview[];
  question: string;
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<JurisdictionId | null>(null);
  const markers = useMemo(
    () =>
      jurisdictions.map((place) => ({
        id: place.id,
        label: place.name,
        coordinates: place.markerCoordinates,
        displayOffset: MARKER_DISPLAY_OFFSETS[place.id],
      })),
    [jurisdictions],
  );
  const selected = jurisdictions.find((place) => place.id === selectedId);

  return (
    <div className={cn("relative min-w-0 max-w-full", className)}>
      <WireframeDottedGlobe
        className="mx-auto"
        markers={markers}
        selectedMarkerId={selectedId}
        onMarkerSelect={(markerId) => setSelectedId(markerId as JurisdictionId)}
      />

      {/* The panel keeps its own reserved slot, so selecting never reflows the
          page and the globe does not move under the pointer. */}
      <div
        className="mt-4 flex min-h-[15rem] w-full min-w-0 justify-center px-2"
        aria-live="polite"
      >
        {selected ? (
          <aside
            key={selected.id}
            className="w-full max-w-[21rem] self-start rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-lg backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected.name}</p>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{question}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <TruthBadge value={selected.result === "+1" ? "true" : "false"}>
                  {selected.answer}
                </TruthBadge>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close jurisdiction preview"
                  className="-mr-1 grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>

            <p className="mt-2.5 text-[0.72rem] leading-5 text-muted-foreground">{selected.note}</p>

            {selected.qualifying.length > 0 ? (
              <ul className="mt-2.5 space-y-1">
                {selected.qualifying.map((citation) => (
                  <li key={citation} className="font-mono text-[0.66rem] text-foreground/85">
                    {citation}
                  </li>
                ))}
              </ul>
            ) : null}

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[0.7rem]">
              <dt className="text-muted-foreground">Receipt score</dt>
              <dd className="text-right tabular-nums">{selected.result}</dd>
              <dt className="text-muted-foreground">Provisions considered</dt>
              <dd className="text-right tabular-nums">{selected.consideredProvisions}</dd>
              <dt className="text-muted-foreground">Not yet traced</dt>
              <dd className="text-right tabular-nums">{selected.untraced}</dd>
            </dl>

            <Button
              className="mt-3 min-h-9 w-full text-[0.72rem]"
              nativeButton={false}
              render={
                <Link href="/demo">
                  See how this was answered
                  <ArrowRight />
                </Link>
              }
            />
          </aside>
        ) : (
          <p className="max-w-[34ch] self-start pt-2 text-center text-xs leading-5 whitespace-normal text-muted-foreground">
            Select a marker for its answer, or tab to the globe and use the arrow keys.
          </p>
        )}
      </div>
    </div>
  );
}
