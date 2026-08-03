/**
 * One reviewed record, assembled for reading.
 *
 * Joins three things that already exist and invents none of them: the reviewed
 * claim (`demo-analysis.ts`), the retrieved passage and its document
 * (`pilot-sources.ts`), and the curated reading (`lab-record-presentation.ts`).
 *
 * Two rules govern this file.
 *
 * Nothing is dropped. Every field the reviewers recorded reaches the view, in
 * the guided order first and the record's own order after it. A field hidden
 * here would be read as a field nobody filled in, which is a different claim
 * about the evidence.
 *
 * Nothing is approximated. An anchor phrase that is not found in the passage
 * throws rather than going quietly missing, because a highlight that points at
 * the wrong words is worse than no highlight at all.
 */

import {
  DEMO_ANALYSIS_CORPORA,
  DEMO_ANALYSIS_SOURCE,
  demoAnalysisClaimRecords,
  demoAnalysisDataset,
  demoAnalysisEvidenceEntries,
  type ClaimRecord,
} from "./demo-analysis.js";
import { humanize, instrumentLabel, type ClaimFields } from "./demo-analysis-format.js";
import { sourceDocuments, sourcePassages, unsourcedRows } from "./pilot-sources.js";
import {
  GUIDED_FIELD_ORDER,
  LAB_RECORDS,
  STRUCTURAL_KEYS,
  type LabRecordAnchor,
} from "./lab-record-presentation.js";
import { renderRecordYaml, type YamlLine } from "./record-yaml.js";
import { recordChecks, type RecordCheck } from "./record-checks.js";
import type {
  LabRecordField,
  LabRecordResolution,
  LabRecordSource,
  LabRecordSummary,
  LabRecordView,
  RecordFieldKey,
} from "./record-view.js";

export type { LabRecordResolution, LabRecordSummary, LabRecordView } from "./record-view.js";

/** The record the Lab opens on when nothing else is asked for. */
const DEFAULT_RECORD_ID = "EU-06";

function fail(message: string): never {
  throw new Error(`lab-record: ${message}`);
}

/* ------------------------------------------------------------------- source */

function sourceFor(claim: ClaimRecord): LabRecordSource {
  const passages = sourcePassages();
  const documents = sourceDocuments();

  const direct = passages.find((passage) => passage.row_id === claim.claimId);
  const inherited = direct
    ? undefined
    : passages.find((passage) => passage.row_id === claim.parentRowId);
  const passage = direct ?? inherited;

  if (!passage) {
    const unresolved = unsourcedRows().find(
      (row) => row.row_id === claim.claimId || row.row_id === claim.parentRowId,
    );
    return {
      state: "unresolved",
      passageRowId: null,
      quote: null,
      locator: null,
      anchorPhrase: null,
      anchorHash: null,
      document: null,
      // The registry's own words. A record with no source says why, in the
      // sourcing pass's terms, rather than in ours.
      unresolvedReason:
        unresolved?.reason ?? "No source document is registered for this instrument.",
    };
  }

  const document = documents.find((item) => item.id === passage.document_version_id);
  return {
    state: direct ? "direct" : "inherited",
    passageRowId: passage.row_id,
    quote: passage.quote,
    locator: passage.page_number ? `p. ${passage.page_number}` : (passage.dom_path ?? null),
    anchorPhrase: passage.anchor_phrase ?? null,
    anchorHash: passage.anchor_hash,
    document: document
      ? {
          title: document.title,
          uri: document.uri,
          publisher: document.publisher,
          issuedAt: document.issued_at,
          retrievedAt: document.retrieved_at,
          sha256: document.sha256,
          sourceTier: document.source_tier,
        }
      : null,
    unresolvedReason: null,
  };
}

/* ------------------------------------------------------------------- fields */

/** Every key the record actually carries, in guided order, then its own order. */
function recordedKeys(fields: ClaimFields): RecordFieldKey[] {
  const present = new Set(
    Object.entries(fields as unknown as Record<string, unknown>)
      .filter(([key, value]) => {
        if (STRUCTURAL_KEYS.has(key)) return false;
        if (value === undefined || value === null) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.keys(value).length > 0;
        return String(value).trim() !== "";
      })
      .map(([key]) => key),
  );

  const ordered = GUIDED_FIELD_ORDER.filter((spec) => present.has(spec.key)).map(
    (spec) => spec.key,
  );
  // Anything the guided order does not name still appears, so a field can never
  // be lost by being forgotten here.
  const tail = [...present].filter((key) => !ordered.includes(key as RecordFieldKey));
  return [...ordered, ...(tail as RecordFieldKey[])];
}

function displayValue(raw: unknown): { value: string; raw: string } {
  if (Array.isArray(raw)) {
    return { value: raw.map((item) => humanize(String(item))).join(", "), raw: raw.join(", ") };
  }
  if (raw && typeof raw === "object") {
    const pairs = Object.entries(raw as Record<string, string>);
    return {
      value: pairs.map(([key, value]) => `${humanize(key)}: ${value}`).join(", "),
      raw: pairs.map(([key, value]) => `${key}=${value}`).join(", "),
    };
  }
  const token = String(raw).replace(/\s+/g, " ").trim();
  // `unknown` is a recorded judgment and reaches the reader as `unknown`.
  return { value: token === "unknown" ? "unknown" : humanize(token), raw: token };
}

/**
 * The reviewers wrote some of these fields as prose and some as coded tokens —
 * "European Commission" beside `federal_agencies`. Sentence-casing the prose
 * would break it ("European commission"); printing the token raw would leak an
 * underscore into the page. So: a value that is entirely lowercase and
 * underscores is a token and is humanized, and anything else is left as written.
 */
function verbatim(value: string): string {
  const token = String(value).replace(/\s+/g, " ").trim();
  return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(token) ? humanize(token) : token;
}

/** The record's own wording is shown as written, not sentence-cased. */
const VERBATIM_KEYS: ReadonlySet<string> = new Set([
  "actor_term_local",
  "recipient_actor_term_local",
  "additional_actor_term_local",
  "current_actor_term_local",
  "prospective_actor_term_local",
  "conduct_term_local",
  "exception_scope_local",
  "exception_conditions_status",
  "proposal_action",
  "responsible_authority",
  "responsible_authorities",
  "potential_responsible_authorities",
  "additional_authority",
  "implementation_body",
  "policy_authority",
  "policy_origin",
  "effective_from",
  "compliance_deadline",
]);

function fieldValue(key: RecordFieldKey, raw: unknown): { value: string; raw: string } {
  // An instrument has a registered display name; humanizing its token instead
  // would render "EU_AI_ACT" as "EU AI act".
  if ((key === "instrument" || key === "underlying_instrument") && typeof raw === "string") {
    return { value: instrumentLabel(raw), raw };
  }
  if (VERBATIM_KEYS.has(key)) {
    if (Array.isArray(raw)) {
      return { value: raw.map(verbatim).join(", "), raw: raw.join(", ") };
    }
    const token = String(raw).replace(/\s+/g, " ").trim();
    return { value: verbatim(token), raw: token };
  }
  return displayValue(raw);
}

/* ------------------------------------------------------------------ anchors */

/**
 * Resolve each curated phrase to a span of the passage.
 *
 * Every failure mode is a thrown error rather than a missing highlight: a
 * curated record that is not in the dataset, an anchor on a field the record
 * does not carry, a phrase that is not in the passage, an anchor on a record
 * with no passage at all, or two spans that overlap and so cannot both be shown.
 */
function resolveAnchors(
  id: string,
  anchors: readonly LabRecordAnchor[],
  source: LabRecordSource,
  present: readonly RecordFieldKey[],
): Map<RecordFieldKey, { start: number; end: number }> {
  const resolved = new Map<RecordFieldKey, { start: number; end: number }>();
  if (anchors.length === 0) return resolved;

  if (!source.quote) {
    fail(`${id} declares ${anchors.length} anchor(s) but has no retrieved passage`);
  }

  const spans: { start: number; end: number }[] = [];
  for (const anchor of anchors) {
    if (!present.includes(anchor.field)) {
      fail(`${id} anchors ${anchor.field}, which the record does not carry`);
    }
    const start = source.quote.indexOf(anchor.phrase);
    if (start === -1) {
      fail(`${id} anchor for ${anchor.field} is not in the passage: "${anchor.phrase}"`);
    }
    const span = { start, end: start + anchor.phrase.length };
    for (const other of spans) {
      if (span.start < other.end && other.start < span.end) {
        fail(`${id} anchor for ${anchor.field} overlaps another anchor`);
      }
    }
    spans.push(span);
    resolved.set(anchor.field, span);
  }
  return resolved;
}

/* --------------------------------------------------------------------- view */

function buildView(presentation: (typeof LAB_RECORDS)[number]): LabRecordView {
  const claim = demoAnalysisClaimRecords().find((item) => item.claimId === presentation.id);
  if (!claim) fail(`${presentation.id} is not in the reviewed dataset`);

  const entry = demoAnalysisEvidenceEntries().find((item) => item.id === presentation.id);
  if (!entry) fail(`${presentation.id} has no evidence entry`);

  const source = sourceFor(claim);
  const keys = recordedKeys(claim.fields);
  const anchors = resolveAnchors(presentation.id, presentation.anchors, source, keys);

  const labels = new Map(GUIDED_FIELD_ORDER.map((spec) => [spec.key, spec]));
  const raw = claim.fields as unknown as Record<string, unknown>;

  // One ordering, two renderings: the code view is built from the same list, so
  // a field's place in the guided view and in the YAML can never disagree.
  const yamlLines: YamlLine[] = keys.map((key) => {
    const value = raw[key];
    return {
      key,
      value: Array.isArray(value) ? value.map(String) : fieldValue(key, value).raw,
      field: key,
    };
  });

  const rendered = renderRecordYaml(
    [
      `${presentation.id} — reviewed record, as stored.`,
      `Source: ${DEMO_ANALYSIS_SOURCE}`,
      "This is the record. A Writ query is a separate file.",
    ],
    [
      { key: "row_id", value: presentation.id },
      { key: "jurisdiction", value: claim.jurisdiction },
      { key: "source_locator", value: claim.sourceLocator },
      ...yamlLines,
    ],
  );

  const fields: LabRecordField[] = keys.map((key) => {
    const spec = labels.get(key);
    const { value, raw: token } = fieldValue(key, raw[key]);
    return {
      key,
      label: spec?.label ?? humanize(key),
      group: spec?.group ?? "other",
      value,
      raw: token,
      isUnknown: token === "unknown",
      codeLines: rendered.linesByField.get(key) ?? [],
      anchor: anchors.get(key) ?? null,
    };
  });

  const dataset = demoAnalysisDataset();

  return {
    claimId: claim.claimId,
    parentRowId: claim.parentRowId,
    jurisdiction: claim.jurisdiction,
    instrument: instrumentLabel(claim.instrument),
    instrumentToken: claim.instrument,
    sourceLocator: claim.sourceLocator,
    recordType: claim.fields.record_type,
    fields,
    source,
    code: {
      text: rendered.text,
      lines: rendered.lines,
      filename: `${presentation.id.toLowerCase()}.record.yaml`,
      label: "Reviewed record, as stored",
      caption:
        "The record as the reviewers stored it. Writ queries are separate files — see Technical details.",
    },
    explanation: {
      reading: presentation.reading,
      limit: presentation.limit,
      why: presentation.why,
      badge: presentation.badge,
      summary: entry.summary,
      reviewerNote: {
        text: claim.interpretationNote.replace(/\s+/g, " ").trim(),
        inherited: claim.claimId !== claim.parentRowId,
      },
    },
    versions: {
      datasetId: dataset.dataset_id,
      schemaVersion: dataset.schema_version,
      reviewStatus: dataset.review_status,
      datasetSource: DEMO_ANALYSIS_SOURCE,
      corpusPaths: DEMO_ANALYSIS_CORPORA,
    },
  };
}

// Built once. `/lab` reads searchParams and so is dynamic, and the joins below
// rescan the provenance files on every call.
let viewCache: readonly LabRecordView[] | undefined;
let checkCache: ReadonlyMap<string, readonly RecordCheck[]> | undefined;

export function labRecordViews(): readonly LabRecordView[] {
  if (viewCache === undefined) {
    viewCache = LAB_RECORDS.map(buildView);
  }
  return viewCache;
}

export function labRecordView(id: string): LabRecordView | undefined {
  return labRecordViews().find((view) => view.claimId === id);
}

export function labRecordChecks(id: string): readonly RecordCheck[] {
  if (checkCache === undefined) {
    checkCache = new Map(
      labRecordViews().map((view) => {
        const claim = demoAnalysisClaimRecords().find((item) => item.claimId === view.claimId)!;
        return [
          view.claimId,
          recordChecks({
            fields: claim.fields,
            source: view.source,
            interpretation: view.explanation.reviewerNote,
          }),
        ];
      }),
    );
  }
  return checkCache.get(id) ?? [];
}

export function labRecordSummaries(): readonly LabRecordSummary[] {
  return labRecordViews().map((view) => ({
    id: view.claimId,
    jurisdiction: view.jurisdiction,
    instrument: view.instrument,
    sourceLocator: view.sourceLocator,
    summary: view.explanation.summary,
    hasSource: view.source.state !== "unresolved",
  }));
}

/**
 * Which record `?record=` means.
 *
 * A request for a record the Lab does not carry is answered with one it does,
 * and the header says so. Silently swapping would misattribute a passage; a
 * not-found would lose the reader for a link that was nearly right.
 */
export function resolveLabRecordId(requested: string | null): LabRecordResolution {
  if (!requested) return { id: DEFAULT_RECORD_ID, requested: null, how: "default" };

  const views = labRecordViews();
  if (views.some((view) => view.claimId === requested)) {
    return { id: requested, requested, how: "exact" };
  }
  // A child of a curated bundle resolves to the curated child of that bundle.
  const claim = demoAnalysisClaimRecords().find((item) => item.claimId === requested);
  if (claim) {
    const sibling = views.find((view) => view.parentRowId === claim.parentRowId);
    if (sibling) return { id: sibling.claimId, requested, how: "parent" };
  }
  return { id: DEFAULT_RECORD_ID, requested, how: "default" };
}
