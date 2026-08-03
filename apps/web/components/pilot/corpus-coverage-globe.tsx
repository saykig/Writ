"use client";

/**
 * Where Writ currently has reviewed corpus coverage.
 *
 * The globe is a map of what exists, not a demonstration of what it concludes.
 * A marker means there is a reviewed corpus for that jurisdiction; the absence
 * of one means there is not. Nothing here promises future coverage, and nothing
 * here reports a finding — a finding belongs to a record, and a record belongs
 * to the Lab.
 *
 * Hovering or focusing a marker gives its name and how many corpora it carries.
 * Selecting one opens a single panel beside the globe, and the panel's only
 * action opens the Lab with that jurisdiction already chosen. Selecting never
 * navigates on its own: the reader stays on the homepage until they ask to
 * leave.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, XIcon } from "lucide-react";

import { corpusCountLabel, type CorpusCoverage, type JurisdictionId } from "@/lib/corpus-coverage";
import { Button } from "@/components/ui/button";
import { WireframeDottedGlobe } from "@/components/ui/wireframe-dotted-globe";
import { cn } from "@/lib/utils";

export function CorpusCoverageGlobe({
  coverage,
  className,
}: {
  coverage: readonly CorpusCoverage[];
  className?: string;
}) {
  const [selectedId, setSelectedId] = useState<JurisdictionId | null>(null);
  const markers = useMemo(
    () =>
      coverage.map((place) => ({
        id: place.id,
        label: place.name,
        sublabel: corpusCountLabel(place.corpusCount),
        coordinates: place.coordinates,
        ...(place.displayOffset ? { displayOffset: place.displayOffset } : {}),
      })),
    [coverage],
  );
  // One panel at a time: selecting a second marker replaces the first.
  const selected = coverage.find((place) => place.id === selectedId);

  return (
    <div className={cn("relative min-w-0 max-w-full", className)}>
      <WireframeDottedGlobe
        className="mx-auto"
        markers={markers}
        markersLabel="Jurisdictions with reviewed corpus coverage"
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
                <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                  {corpusCountLabel(selected.corpusCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close corpus coverage panel"
                className="-mr-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>

            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
                {selected.family}
              </p>
              <p className="mt-1 text-[0.82rem] font-medium">{selected.title}</p>
              <p className="mt-2 text-[0.72rem] leading-5 text-muted-foreground">
                {selected.description}
              </p>
            </div>

            {/* The globe connects to the Lab and to nothing else for now. */}
            <Button
              className="mt-3.5 min-h-9 w-full text-[0.72rem]"
              nativeButton={false}
              render={
                <Link href={selected.labHref}>
                  Inspect in Lab
                  <ArrowRight />
                </Link>
              }
            />
          </aside>
        ) : (
          <p className="max-w-[34ch] self-start pt-2 text-center text-xs leading-5 whitespace-normal text-muted-foreground">
            Select a marker to see where Writ currently has reviewed corpus coverage.
          </p>
        )}
      </div>
    </div>
  );
}
