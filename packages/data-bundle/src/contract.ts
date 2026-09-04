export const WRIT_DATA_BUNDLE_FORMAT_VERSION = "1.0.0" as const;
export const REVIEW_ARTIFACT_BUNDLE_FORMAT_VERSION = "1.1.0" as const;

export type JsonObject = Readonly<Record<string, unknown>>;
export type BundleSourceLanguage = "json" | "writ" | "yaml";

export interface BundleSource {
  readonly path: string;
  /** Stable identity of an exact declaration/sequence item inside path, or null for the whole file. */
  readonly fragment: string | null;
  readonly language: BundleSourceLanguage;
  readonly sha256: string;
  readonly content: string;
}

export interface BundleRecordContract {
  readonly kind: "compatibility" | "native";
  readonly id: string;
  readonly version: string;
}

export type BundleCanonicalIdentity =
  | { readonly kind: "dataset_collection"; readonly datasetCollectionId: string }
  | { readonly kind: "instrument"; readonly instrumentId: string }
  | { readonly kind: "instrument_series"; readonly instrumentSeriesId: string }
  | { readonly kind: "publication"; readonly publicationId: string }
  | { readonly kind: "root_institution"; readonly rootInstitutionId: string };

export interface BundleCatalog {
  readonly source: BundleSource;
  readonly schemaVersion: string;
  readonly implementedNativeFamilies: readonly string[];
  readonly nativeCorpora: readonly {
    readonly corpusId: string;
    readonly family: string;
    readonly jurisdiction: string;
    readonly status: string;
    readonly path: string;
    readonly manifestPath: string;
  }[];
  readonly retiredCorpusMigrations: readonly JsonObject[];
}

export type BundleManifestCategory =
  "judgments" | "migration" | "passages" | "records" | "relationships" | "sources";

export interface BundleCorpus {
  readonly corpusId: string;
  readonly family: string;
  readonly jurisdiction: string;
  readonly status: string;
  readonly path: string;
  readonly manifestPath: string;
  readonly canonicalIdentity: BundleCanonicalIdentity;
  readonly recordContract: BundleRecordContract;
  readonly manifest: JsonObject;
  readonly manifestSource: BundleSource;
  readonly resources: Readonly<Record<BundleManifestCategory, readonly string[]>>;
}

export type BundleResource = BundleSource;

export interface BundleEvidenceSource {
  readonly sourceId: string | null;
  readonly documentVersionId: string | null;
  readonly title: string | null;
  readonly uri: string | null;
  readonly publisher: string | null;
  readonly issuedAt: string | null;
  readonly retrievedAt: string | null;
  readonly mediaType: string | null;
  readonly sourceTier: number | null;
}

export interface BundleEvidenceSupport {
  readonly supportId: string;
  readonly state: "traced" | "unresolved";
  readonly passageId: string | null;
  readonly locator: string | null;
  readonly quote: string | null;
  readonly basis: string | null;
  readonly passageHash: string | null;
  readonly documentHash: string | null;
  readonly reason: string | null;
  readonly source: BundleEvidenceSource;
}

export interface BundleRecord {
  readonly recordKey: string;
  readonly corpusId: string;
  readonly recordId: string;
  readonly family: string;
  readonly recordType: string;
  readonly reviewState: string | null;
  readonly aliases: readonly string[];
  readonly legacyRefs: readonly string[];
  readonly reference: string | null;
  readonly contract: BundleRecordContract;
  readonly evidence: readonly BundleEvidenceSupport[];
  readonly uncertainties: readonly unknown[];
  readonly storedSource: BundleSource;
  readonly storedRecord: JsonObject | null;
  readonly compiledRecord: JsonObject | null;
}

export interface BundleRecordLink {
  readonly linkKey: string;
  readonly corpusId: string;
  readonly linkId: string;
  readonly reviewState: string;
  readonly contractId: string;
  readonly storedSource: BundleSource;
  readonly value: JsonObject;
}

export interface BundleRecordJudgment {
  readonly judgmentKey: string;
  readonly corpusId: string;
  readonly judgmentId: string;
  readonly targetKind: string;
  readonly targetId: string;
  readonly status: string;
  readonly contractId: string;
  readonly storedSource: BundleSource;
  readonly compiledJudgment: JsonObject;
  /** Exact bytes for the separate compiledJudgment.review_artifact binding, when declared. */
  readonly reviewArtifact?: {
    readonly encoding: "base64";
    readonly content: string;
  };
}

export interface WritDataBundle {
  readonly metadata: {
    readonly bundleFormatVersion:
      typeof WRIT_DATA_BUNDLE_FORMAT_VERSION | typeof REVIEW_ARTIFACT_BUNDLE_FORMAT_VERSION;
    readonly writVersion: string;
    readonly writCommit: string;
    readonly repository: string;
    readonly softwareLicense: string | null;
    readonly softwareLicenseFile: string | null;
    readonly softwareLicenseText: string | null;
    readonly copyrightNotice: string | null;
    readonly thirdPartyNoticesFile: string | null;
    readonly thirdPartyNoticesText: string | null;
    readonly schemaVersions: {
      readonly corpusCatalog: string;
      readonly corpusManifests: readonly string[];
      readonly recordContracts: Readonly<Record<string, string>>;
    };
    readonly sectionHashes: {
      readonly catalog: string;
      readonly corpora: string;
      readonly resources: string;
      readonly records: string;
      readonly recordLinks: string;
      readonly recordJudgments: string;
    };
    readonly bundleHash: string;
  };
  readonly catalog: BundleCatalog;
  readonly corpora: readonly BundleCorpus[];
  readonly resources: readonly BundleResource[];
  readonly records: readonly BundleRecord[];
  readonly recordLinks: readonly BundleRecordLink[];
  readonly recordJudgments: readonly BundleRecordJudgment[];
}
