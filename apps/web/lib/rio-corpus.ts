/**
 * Typed reader for the normalized G20 2024 Rio de Janeiro compliance corpus.
 *
 * These records are *imported* from the published G20 Research Group interim and
 * final compliance reports by the Rio adapter (`writ_ingest.corpus.adapters.g20`).
 * Writ performs no compliance scoring here: `published_result` is the score
 * printed by the G20 Research Group, carried through verbatim with its
 * provenance. Nothing in this module computes, infers, or reproduces a score.
 *
 * The corpus is deliberately partial. The compliance reports enumerate only the
 * 13 commitments selected for monitoring, not the full 174-commitment Rio
 * inventory, so the reconciliation manifest stays `incomplete` and the remaining
 * commitments are absent rather than invented.
 */

import { readRepoJson, readRepoText } from "./repo.js";

const NORMALIZED_DIR = "benchmark/2024-rio-g20/normalized";
const MANIFEST_DIR = "data/manifests/g20/2024-rio";

/** The published ordinal scale. `null` only when a score was not extracted. */
export type PublishedResult = "-1" | "0" | "+1" | "not_applicable" | null;
export type ScoreStatus = "published" | "missing" | "disputed" | "withdrawn";
export type SelectionStatus = "selected" | "not_selected" | "unknown";
export type ReportStage = "preliminary" | "interim" | "final" | "special";

export interface IssueArea {
  source_term: string;
  vocabulary_mapping_id: string | null;
}

export interface IdentifiedCommitment {
  schema_version: string;
  record_type: "identified_commitment";
  institution: "G7" | "G20";
  summit_id: string;
  commitment_id: string;
  exact_text: string;
  issue_areas: IssueArea[];
  source_passage_ids: string[];
  parser_version: string;
  retrieval_date: string;
  extraction_warnings: string[];
}

export interface AssessmentSelection {
  schema_version: string;
  record_type: "assessment_selection";
  institution: "G7" | "G20";
  summit_id: string;
  commitment_id: string;
  selection_status: SelectionStatus;
  selection_source_id: string;
  selection_date: string | null;
  reconciliation_manifest_id: string | null;
  parser_version: string;
  retrieval_date: string;
  extraction_warnings: string[];
}

export interface ComplianceReport {
  schema_version: string;
  record_type: "compliance_report";
  report_id: string;
  institution: "G7" | "G20";
  summit_id: string;
  report_stage: ReportStage;
  assessment_window_start: string | null;
  assessment_window_end: string | null;
  publication_date: string | null;
  supersedes_report_id: string | null;
  source_document_id: string;
  parser_version: string;
  retrieval_date: string;
  extraction_warnings: string[];
}

export interface HistoricalLabel {
  label_type: string;
  label_authority: string;
  usable_for_training_examples: boolean;
  usable_for_evaluation: boolean;
  usable_for_automatic_score_transfer: boolean;
}

export interface MemberComplianceAssessment {
  schema_version: string;
  record_type: "member_compliance_assessment";
  assessment_id: string;
  report_id: string;
  commitment_id: string;
  member_id: string;
  published_result: PublishedResult;
  score_status: ScoreStatus;
  source_passage_ids: string[];
  analyst_reasoning: string | null;
  dispute_reason: string | null;
  current_view_status: "included" | "excluded";
  historical_label: HistoricalLabel;
  parser_version: string;
  retrieval_date: string;
  extraction_warnings: string[];
}

export interface ReconciliationManifest {
  schema_version: string;
  record_type: "reconciliation_manifest";
  reconciliation_manifest_id: string;
  institution: "G7" | "G20";
  summit_id: string;
  inventory_source_id: string;
  selected_subset_source_id: string;
  extracted_inventory_count: number;
  extracted_selected_count: number;
  expected_inventory_count: number | null;
  expected_selected_count: number | null;
  validation_status: "valid" | "incomplete" | "conflicted" | "unverified";
  reconciliation_warnings: string[];
  parser_version: string;
  retrieval_date: string;
}

export interface CorpusReviewItem {
  schema_version: string;
  record_type: "corpus_review_item";
  review_item_id: string;
  source_id: string;
  source_location: { passage_id: string | null; page_or_section: string | null };
  issue_type: string;
  parser_version: string;
  affected_record_ids: string[];
  original_source_text: string | null;
  review_status: "pending" | "in_review" | "resolved" | "dismissed";
}

export interface SourceManifestDocument {
  document_id: string;
  category: string;
  source_url: string;
  report_stage: ReportStage | null;
  fetch_status: string;
  storage_backend: string | null;
  storage_object_id: string | null;
  sha256: string | null;
  byte_size: number | null;
  media_type: string | null;
  warnings: string[];
}

export interface SourceManifest {
  schema_version: string;
  manifest_id: string;
  source_id: string;
  institution: string;
  summit_slug: string;
  live_fetch_authorized: boolean;
  raw_files_available: boolean;
  documents: SourceManifestDocument[];
}

/** Display labels for the G20 members as printed in the reports' score table. */
export const RIO_MEMBER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  argentina: "Argentina",
  australia: "Australia",
  brazil: "Brazil",
  canada: "Canada",
  china: "China",
  france: "France",
  germany: "Germany",
  india: "India",
  indonesia: "Indonesia",
  italy: "Italy",
  japan: "Japan",
  south_korea: "Korea",
  mexico: "Mexico",
  russia: "Russia",
  saudi_arabia: "Saudi Arabia",
  south_africa: "South Africa",
  turkiye: "Türkiye",
  united_kingdom: "United Kingdom",
  united_states: "United States",
  african_union: "African Union",
  european_union: "European Union",
});

export interface RioReportView {
  reportId: string;
  stage: ReportStage;
  /** "Interim" | "Final" — for headings. */
  stageLabel: string;
  windowStart: string | null;
  windowEnd: string | null;
  publicationDate: string | null;
  supersedesReportId: string | null;
  sourceDocumentId: string;
  sourceUrl: string | null;
  assessmentCount: number;
  extractionWarnings: string[];
}

export interface RioCommitmentView {
  commitmentId: string;
  exactText: string;
  issueArea: string;
  selectionStatus: SelectionStatus;
  /** Published score per member, keyed by report id then member id. */
  scoresByReport: Record<string, Record<string, PublishedResult>>;
}

export interface RioCorpus {
  summitId: string;
  institution: string;
  parserVersion: string;
  retrievalDate: string;
  labelAuthority: string;
  reports: RioReportView[];
  commitments: RioCommitmentView[];
  members: { id: string; label: string }[];
  reconciliation: ReconciliationManifest;
  reviewItems: CorpusReviewItem[];
  reviewCountsByType: { issueType: string; count: number }[];
  manifest: SourceManifest;
  counts: {
    selectedCommitments: number;
    memberAssessments: number;
    publishedScores: number;
    missingScores: number;
    reviewItems: number;
    members: number;
    reports: number;
    /** Total commitments the source reports were made at the summit (174). */
    expectedInventory: number | null;
    /** Commitments actually enumerated in the corpus (13). */
    extractedInventory: number;
  };
}

const STAGE_LABELS: Record<ReportStage, string> = {
  preliminary: "Preliminary",
  interim: "Interim",
  final: "Final",
  special: "Special",
};

function readNormalized<T>(name: string): T[] {
  return readRepoJson<T[]>(`${NORMALIZED_DIR}/${name}.json`);
}

/**
 * Load the Rio corpus as a view model. Reads only what the adapter emitted;
 * absent records stay absent.
 */
export function rioCorpus(): RioCorpus {
  const commitments = readNormalized<IdentifiedCommitment>("commitments");
  const selections = readNormalized<AssessmentSelection>("selections");
  const reports = readNormalized<ComplianceReport>("reports");
  const assessments = readNormalized<MemberComplianceAssessment>("member_assessments");
  const reconciliation = readNormalized<ReconciliationManifest>("reconciliations")[0];
  const reviewItems = readNormalized<CorpusReviewItem>("review_queue");
  const manifest = readRepoJson<SourceManifest>(`${MANIFEST_DIR}/source-manifest.json`);

  const selectionByCommitment = new Map(selections.map((s) => [s.commitment_id, s]));
  const urlByDocumentId = new Map(manifest.documents.map((d) => [d.document_id, d.source_url]));

  // Interim and final are separate records and are never merged or superseded.
  const stageOrder: ReportStage[] = ["preliminary", "interim", "final", "special"];
  const reportViews: RioReportView[] = [...reports]
    .sort((a, b) => stageOrder.indexOf(a.report_stage) - stageOrder.indexOf(b.report_stage))
    .map((report) => ({
      reportId: report.report_id,
      stage: report.report_stage,
      stageLabel: STAGE_LABELS[report.report_stage],
      windowStart: report.assessment_window_start,
      windowEnd: report.assessment_window_end,
      publicationDate: report.publication_date,
      supersedesReportId: report.supersedes_report_id,
      sourceDocumentId: report.source_document_id,
      sourceUrl: urlByDocumentId.get(report.source_document_id) ?? null,
      assessmentCount: assessments.filter((a) => a.report_id === report.report_id).length,
      extractionWarnings: report.extraction_warnings,
    }));

  const scoreIndex = new Map<string, PublishedResult>();
  const memberIds = new Set<string>();
  for (const assessment of assessments) {
    scoreIndex.set(
      `${assessment.report_id} ${assessment.commitment_id} ${assessment.member_id}`,
      assessment.published_result,
    );
    memberIds.add(assessment.member_id);
  }

  // Member column order follows the printed score table, not the alphabet.
  const members = Object.keys(RIO_MEMBER_LABELS)
    .filter((id) => memberIds.has(id))
    .map((id) => ({ id, label: RIO_MEMBER_LABELS[id] ?? id }));

  const commitmentViews: RioCommitmentView[] = commitments.map((commitment) => {
    const scoresByReport: Record<string, Record<string, PublishedResult>> = {};
    for (const report of reportViews) {
      const row: Record<string, PublishedResult> = {};
      for (const member of members) {
        const key = `${report.reportId} ${commitment.commitment_id} ${member.id}`;
        row[member.id] = scoreIndex.get(key) ?? null;
      }
      scoresByReport[report.reportId] = row;
    }
    return {
      commitmentId: commitment.commitment_id,
      exactText: commitment.exact_text,
      issueArea: commitment.issue_areas[0]?.source_term ?? "—",
      selectionStatus:
        selectionByCommitment.get(commitment.commitment_id)?.selection_status ?? "unknown",
      scoresByReport,
    };
  });

  const reviewCounts = new Map<string, number>();
  for (const item of reviewItems) {
    reviewCounts.set(item.issue_type, (reviewCounts.get(item.issue_type) ?? 0) + 1);
  }

  const firstAssessment = assessments[0];

  return {
    summitId: reports[0]?.summit_id ?? "G20.rio.2024",
    institution: reports[0]?.institution ?? "G20",
    parserVersion: reports[0]?.parser_version ?? "",
    retrievalDate: reports[0]?.retrieval_date ?? "",
    labelAuthority: firstAssessment?.historical_label.label_authority ?? "G20 Research Group",
    reports: reportViews,
    commitments: commitmentViews,
    members,
    reconciliation,
    reviewItems,
    reviewCountsByType: [...reviewCounts.entries()]
      .map(([issueType, count]) => ({ issueType, count }))
      .sort((a, b) => b.count - a.count || a.issueType.localeCompare(b.issueType)),
    manifest,
    counts: {
      selectedCommitments: selections.filter((s) => s.selection_status === "selected").length,
      memberAssessments: assessments.length,
      publishedScores: assessments.filter((a) => a.score_status === "published").length,
      missingScores: assessments.filter((a) => a.score_status === "missing").length,
      reviewItems: reviewItems.length,
      members: members.length,
      reports: reportViews.length,
      expectedInventory: reconciliation?.expected_inventory_count ?? null,
      extractedInventory: commitments.length,
    },
  };
}

/** The Rio ingestion and validation report, as markdown source text. */
export function rioIngestionReport(): string {
  return readRepoText(`${MANIFEST_DIR}/ingestion-report.md`);
}
