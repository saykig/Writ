/**
 * The shape of one reviewed record, prepared for reading.
 *
 * Types only, and free of Node imports, so a client component can name a field
 * without pulling the server-only reader (and `node:crypto` behind it) into the
 * browser bundle. The adapter that fills these in is `lib/lab-record.ts`.
 *
 * Two properties of this shape are load-bearing:
 *
 *   - A field's `anchor` is allowed to be `null`. A record is classified from a
 *     provision, but the retrieved passage is one span of that provision, and
 *     several fields are grounded in wording outside it. Saying so is honest;
 *     inventing a span is not.
 *   - `isUnknown` marks the reviewers' recorded `unknown`. It is not the same as
 *     a field they left empty, and the two must never render alike.
 */

import type { ClaimFields, Jurisdiction } from "./demo-analysis-format.js";

export type RecordFieldKey = keyof ClaimFields;

/** Which part of the record a field belongs to, for grouping in the guided view. */
export type GuidedGroup =
  "identity" | "actor" | "conduct" | "conditions" | "force" | "lifecycle" | "authority" | "other";

export interface LabRecordField {
  key: RecordFieldKey;
  /** Plain-language label, or the coded key where the guided order does not name one. */
  label: string;
  group: GuidedGroup;
  /** Display value. Arrays are joined; nothing is abbreviated. */
  value: string;
  /** The record's own token, before humanizing. */
  raw: string;
  /** True only for the reviewers' recorded `unknown`. */
  isUnknown: boolean;
  /** 1-based code-view lines this field occupies. Never empty. */
  codeLines: readonly number[];
  /** Character span inside the passage quote, or `null` where the field is
   *  grounded in wording outside the retrieved span. */
  anchor: { start: number; end: number } | null;
}

/** Where a record's passage came from, including the case where there is none. */
export type SourceState = "direct" | "inherited" | "unresolved";

export interface SourceDocumentView {
  title: string;
  uri: string;
  publisher: string;
  issuedAt: string;
  retrievedAt: string;
  sha256: string;
  sourceTier: number;
}

export interface LabRecordSource {
  state: SourceState;
  /** The row the passage was recorded against — the record itself, or its bundle parent. */
  passageRowId: string | null;
  quote: string | null;
  /** `p. 15`, or the DOM path for an HTML source. */
  locator: string | null;
  anchorPhrase: string | null;
  anchorHash: string | null;
  document: SourceDocumentView | null;
  /** The registry's own reason, verbatim. Non-null only when unresolved. */
  unresolvedReason: string | null;
}

export interface LabRecordCodeLine {
  n: number;
  text: string;
  /** The field this line belongs to, or `null` for structural lines. */
  field: RecordFieldKey | null;
}

export interface LabRecordCode {
  text: string;
  lines: readonly LabRecordCodeLine[];
  filename: string;
  label: string;
  /** Says what this is, so it is never read as a Writ query. */
  caption: string;
}

export interface LabRecordExplanation {
  /** Written for this interface. */
  reading: string;
  /** Written for this interface: the reading this record must not be stretched into. */
  limit: string;
  /** Written for this interface: why this record is in the Lab at all. */
  why: string;
  /** Written for this interface. */
  badge: string;
  /** Read off the record: actor, conduct, force, applicability. */
  summary: string;
  /** The reviewers' own note, verbatim. Inherited from the bundle for a child claim. */
  reviewerNote: { text: string; inherited: boolean };
}

export interface LabRecordSummary {
  id: string;
  jurisdiction: Jurisdiction;
  instrument: string;
  sourceLocator: string;
  /** Read off the record, not written for the selector. */
  summary: string;
  hasSource: boolean;
}

export interface LabRecordVersions {
  datasetId: string;
  schemaVersion: string;
  reviewStatus: string;
  datasetSource: string;
  corpusPaths: Readonly<Record<Jurisdiction, string>>;
}

export interface LabRecordView {
  claimId: string;
  parentRowId: string;
  jurisdiction: Jurisdiction;
  /** Display name for the instrument; the stored token is `instrumentToken`. */
  instrument: string;
  instrumentToken: string;
  sourceLocator: string;
  recordType: string;
  fields: readonly LabRecordField[];
  source: LabRecordSource;
  code: LabRecordCode;
  explanation: LabRecordExplanation;
  versions: LabRecordVersions;
}

/** How `?record=` was resolved, so the header can say when it was not exact. */
export interface LabRecordResolution {
  id: string;
  requested: string | null;
  how: "exact" | "parent" | "default";
}
