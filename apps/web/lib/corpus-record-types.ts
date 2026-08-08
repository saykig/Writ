export type CorpusFamily = "legal_policy" | "institutional";
export type CorpusStatus = "active" | "draft";
export type CorpusReviewState = "accepted" | "approved";
export type CorpusTraceState = "fully_traced" | "partially_traced" | "untraced";

export interface CorpusRecordIndex {
  readonly recordKey: string;
  readonly recordId: string;
  readonly displayId: string;
  readonly legacyIds: readonly string[];
  readonly corpusId: string;
  readonly corpusTitle: string;
  readonly corpusStatus: CorpusStatus;
  readonly corpusIndex: number;
  readonly recordIndex: number;
  readonly family: CorpusFamily;
  readonly jurisdiction: "EU" | "US";
  readonly reviewState: CorpusReviewState;
  readonly title: string;
  readonly summary: string;
  readonly sourceLabel: string | null;
  readonly locator: string | null;
  readonly traceState: CorpusTraceState;
  readonly searchableText: string;
  readonly labRecordId: string | null;
  readonly legalForce?: string;
  readonly adoption?: string;
  readonly applicability?: string;
  readonly enforcement?: string;
  readonly factType?: string;
}

export interface CorpusEvidenceSource {
  readonly sourceId: string | null;
  readonly title: string | null;
  readonly uri: string | null;
  readonly publisher: string | null;
  readonly issuedAt: string | null;
  readonly retrievedAt: string | null;
  readonly mediaType: string | null;
  readonly sourceTier: number | null;
}

export interface CorpusEvidenceSupport {
  readonly supportId: string;
  readonly state: "traced" | "unresolved";
  readonly passageId: string | null;
  readonly locator: string | null;
  readonly quote: string | null;
  readonly basis: string | null;
  readonly passageHash: string | null;
  readonly documentHash: string | null;
  readonly reason: string | null;
  readonly source: CorpusEvidenceSource;
}

export interface CorpusStructuredSource {
  readonly label: "Stored YAML" | "Canonical .writ source";
  readonly language: "yaml" | "writ";
  readonly path: string;
  readonly content: string;
}

export interface CorpusRecordDetail {
  readonly index: CorpusRecordIndex;
  readonly interpretation: string | null;
  readonly assertion: string | null;
  readonly evidence: readonly CorpusEvidenceSupport[];
  readonly uncertainties: readonly { readonly type: string; readonly description: string }[];
  readonly recordedFields: Readonly<Record<string, unknown>>;
  readonly storedSource: CorpusStructuredSource;
  readonly compiledOutput: Readonly<Record<string, unknown>> | null;
  readonly technical: {
    readonly corpusId: string;
    readonly recordId: string;
    readonly displayId: string;
    readonly legacyIds: readonly string[];
    readonly reviewState: CorpusReviewState;
    readonly corpusStatus: CorpusStatus;
    readonly sourcePath: string;
  };
}
