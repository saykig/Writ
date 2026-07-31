/**
 * The homepage and demo view of the archived EU-US pilot analysis.
 *
 * Each jurisdiction's preview is produced by actually running the reviewed rule
 * against that jurisdiction's evidence snapshot. The verdict, the provisions
 * that qualified, and the number of provisions considered all come from the
 * receipt, so nothing here can drift from what the Lab shows.
 */

import type { Evidence } from "@writ/domain";

import { instrumentLabel } from "./policy-test-format.js";
import { readRepoJson } from "./repo.js";
import { evaluatePilot, pilotCoverage, pilotExampleSource } from "./toolchain.js";

const PILOT_DIR = "archive/pilots/eu-us-ai-evaluation-v1/original";

export type JurisdictionId = "eu" | "us";

export interface PilotPreview {
  readonly id: JurisdictionId;
  readonly name: string;
  readonly markerCoordinates: readonly [number, number];
  readonly markerAnchor: string;
  /** The plain answer to the pilot's question. */
  readonly answer: "Yes" | "No";
  /** The receipt's own score, kept beside the plain answer rather than behind it. */
  readonly result: string;
  readonly resultStatus: string;
  /** The provisions that satisfied every condition, cited. */
  readonly qualifying: readonly string[];
  /** One line on what the verdict does and does not mean. */
  readonly note: string;
  readonly consideredProvisions: number;
  /** Reviewed claims not yet traced to a source document, so not evaluated. */
  readonly untraced: number;
}

const PLACES: Record<
  JurisdictionId,
  { name: string; markerCoordinates: readonly [number, number]; markerAnchor: string }
> = {
  eu: { name: "European Union", markerCoordinates: [4.3517, 50.8503], markerAnchor: "Brussels" },
  us: {
    name: "United States",
    markerCoordinates: [-77.0369, 38.9072],
    markerAnchor: "Washington, D.C.",
  },
};

const NOTES: Record<JurisdictionId, string> = {
  eu: "One provision carries the duty, and only for models classed as posing systemic risk.",
  us: "Federal agencies and their vendors carry binding testing duties. Providers do not.",
};

let cache: readonly PilotPreview[] | undefined;

export function pilotPreviews(): readonly PilotPreview[] {
  if (cache !== undefined) return cache;
  const source = pilotExampleSource("reviewed");
  if (source === undefined) throw new Error("The reviewed pilot methodology is missing.");
  const coverage = pilotCoverage();

  cache = (["eu", "us"] as const).map((id) => {
    const evaluated = evaluatePilot(source, id);
    const receipt = evaluated.receipt;
    if (!receipt) throw new Error(`The pilot did not evaluate for "${id}": ${evaluated.error}`);

    const snapshot = readRepoJson<Evidence>(`${PILOT_DIR}/evidence/${id}.snapshot.json`);
    const cited = new Map(
      snapshot.claims.map((claim) => {
        const qualifiers = (claim.qualifiers ?? {}) as Record<string, string>;
        const instrument = instrumentLabel(qualifiers.instrument ?? "");
        return [claim.id, `${instrument}, ${qualifiers.source_locator}`.trim()];
      }),
    );

    return {
      id,
      ...PLACES[id],
      // Only "+1" means a provision satisfied every condition. "0" here means
      // binding duties were found, but none of them on a provider.
      answer: receipt.result === "+1" ? ("Yes" as const) : ("No" as const),
      result: receipt.result,
      resultStatus: receipt.result_status,
      qualifying:
        receipt.result === "+1"
          ? (receipt.qualifying_action_ids ?? []).map((claimId) => cited.get(claimId) ?? claimId)
          : [],
      note: NOTES[id],
      consideredProvisions: snapshot.claims.length,
      untraced: coverage[id.toUpperCase()]?.omitted.length ?? 0,
    };
  });
  return cache;
}

export function pilotPreview(id: string): PilotPreview | undefined {
  return pilotPreviews().find((preview) => preview.id === id);
}
