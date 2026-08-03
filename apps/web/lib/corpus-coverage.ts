/**
 * Where Writ currently has reviewed corpus coverage.
 *
 * A small presentation configuration for the homepage globe, and nothing more.
 * It describes coverage that already exists; it does not read the corpora, does
 * not count records, and adds nothing to them.
 *
 * Two rules keep it honest:
 *
 *   - Only jurisdictions with a reviewed corpus appear. There are no "coming
 *     soon" markers, because a marker is a claim that reviewed material exists.
 *   - The European Union is one entry, not twenty-seven. The corpus is recorded
 *     at Union level, and splitting it across member states would show coverage
 *     the reviewers never claimed.
 *
 * Corpus families that are not geographic — theories, methods, concepts — have
 * no place on a globe and are deliberately absent rather than approximated.
 */

import type { Route } from "next";

export type JurisdictionId = "eu" | "us";

export interface CorpusCoverage {
  readonly id: JurisdictionId;
  readonly name: string;
  /** Longitude, latitude of the marker's anchor. */
  readonly coordinates: readonly [number, number];
  /** Presentation-only nudge, so the two labels clear the globe's edge. */
  readonly displayOffset?: readonly [number, number];
  readonly corpusCount: number;
  readonly family: string;
  readonly title: string;
  readonly description: string;
  readonly labHref: Route;
}

export const CORPUS_COVERAGE: readonly CorpusCoverage[] = [
  {
    id: "eu",
    name: "European Union",
    // Brussels, as the Union's seat rather than any member state's capital.
    coordinates: [4.3517, 50.8503],
    displayOffset: [48, 18],
    corpusCount: 1,
    family: "AI governance",
    title: "European Union AI Evaluation",
    description:
      "Reviewed records concerning GPAI obligations, model evaluation, exceptions and compliance pathways.",
    labHref: "/lab?jurisdiction=eu" as Route,
  },
  {
    id: "us",
    name: "United States",
    coordinates: [-77.0369, 38.9072],
    corpusCount: 1,
    family: "AI governance",
    title: "United States AI Evaluation",
    description:
      "Reviewed records concerning federal policy, government use, procurement and voluntary model-evaluation guidance.",
    labHref: "/lab?jurisdiction=us" as Route,
  },
];

/** "1 reviewed corpus", and correct if a second one is ever added. */
export function corpusCountLabel(count: number): string {
  return `${count} reviewed ${count === 1 ? "corpus" : "corpora"}`;
}
