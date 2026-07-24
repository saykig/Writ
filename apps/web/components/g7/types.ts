export type G7MemberId =
  | "canada"
  | "france"
  | "germany"
  | "italy"
  | "japan"
  | "united_kingdom"
  | "united_states"
  | "european_union";

export interface G7AssessmentPreview {
  readonly id: G7MemberId;
  readonly name: string;
  readonly markerCoordinates: readonly [number, number];
  readonly markerAnchor: string;
  readonly topic: string;
  readonly year: number;
  readonly publishedResult: "-1" | "0" | "+1";
  readonly writResult: "-1" | "0" | "+1" | "unresolved" | "not_applicable";
  readonly resultStatus: string;
  readonly reviewedActions: number;
}

export interface G7EvidenceAction {
  readonly id: string;
  readonly label: string;
  readonly classification: string | null;
  readonly implementationStage: string;
  readonly passage: {
    readonly page: number | null;
    readonly quote: string;
  } | null;
  readonly review: {
    readonly reviewerId: string;
    readonly decision: string;
  } | null;
}

export interface G7EvidenceView {
  readonly snapshotId: string;
  readonly frozenAt: string;
  readonly cutoff: string;
  readonly contentHash: string;
  readonly actions: readonly G7EvidenceAction[];
}
