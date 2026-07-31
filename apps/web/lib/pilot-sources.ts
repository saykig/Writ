/**
 * Where each reviewed row came from.
 *
 * The reviewed annotation table records a `source_locator` but not the text at
 * it. The archived `reference-code/fetch_pilot_sources.py` retrieved the official document, hashes
 * the bytes it received, and lifts the verbatim passage; this module reads that
 * output and joins it back onto the rows.
 *
 * A row with no sourced passage is reported as unsourced, never filled in. That
 * is the point of the file: the interface can show which conclusions rest on
 * quoted law and which are still only a reviewer's summary.
 */

import { readRepoJson } from "./repo.js";

const DIR = "archive/pilots/eu-us-ai-evaluation-v1/original/provenance";

export interface SourceDocument {
  id: string;
  document_id: string;
  /** The document's own title, as registered in sources.yml. */
  title: string;
  uri: string;
  media_type: string;
  /** When the bytes below were retrieved. */
  retrieved_at: string;
  issued_at: string;
  /** SHA-256 of the bytes actually received, not of a canonical edition. */
  sha256: string;
  publisher: string;
  /** 1 is the legally official text from the issuing authority. */
  source_tier: number;
}

export interface SourcePassage {
  id: string;
  row_id: string;
  document_version_id: string;
  anchor_type: string;
  page_number?: number;
  dom_path?: string;
  /** For topical locators, the phrase used to find the passage. */
  anchor_phrase?: string;
  /** The document's own words. Never a paraphrase. */
  quote: string;
  anchor_hash: string;
  language: string;
}

export interface UnsourcedRow {
  row_id: string;
  instrument: string;
  source_locator: string;
  reason: string;
}

export function sourceDocuments(): SourceDocument[] {
  return readRepoJson<SourceDocument[]>(`${DIR}/document-versions.json`);
}

export function sourcePassages(): SourcePassage[] {
  return readRepoJson<SourcePassage[]>(`${DIR}/passages.json`);
}

export function unsourcedRows(): UnsourcedRow[] {
  return readRepoJson<UnsourcedRow[]>(`${DIR}/unresolved.json`);
}

export interface SourcedRow {
  passage: SourcePassage;
  document: SourceDocument;
  /** "p. 15" or the DOM path, whichever the anchor recorded. */
  anchor: string;
}

/** The quoted passage and its document for one row, when it has been sourced. */
export function sourceFor(rowId: string): SourcedRow | undefined {
  const passage = sourcePassages().find((item) => item.row_id === rowId);
  if (!passage) return undefined;
  const document = sourceDocuments().find((item) => item.id === passage.document_version_id);
  if (!document) return undefined;
  return {
    passage,
    document,
    anchor: passage.page_number ? `p. ${passage.page_number}` : (passage.dom_path ?? ""),
  };
}

export interface SourcingSummary {
  sourced: number;
  total: number;
  documents: number;
}

export function sourcingSummary(totalRows: number): SourcingSummary {
  // Counted by subtracting what did not resolve, not by counting passages: a
  // bundle whose children carry their own anchors produces more passages than
  // rows, and counting those would overstate how much of the table is traced.
  return {
    sourced: totalRows - unsourcedRows().length,
    total: totalRows,
    documents: sourceDocuments().length,
  };
}
