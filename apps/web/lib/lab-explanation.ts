/**
 * The record, said in ordinary words.
 *
 * Two kinds of line, and they are never mixed on the page:
 *
 *   - `record` — composed from the record's own values. The connecting words are
 *     fixed here; every noun comes from a field. A sentence in this class cannot
 *     say anything the reviewers did not record.
 *   - `editorial` — written for this interface, in
 *     `lab-record-presentation.ts`. It explains an existing judgment; it never
 *     makes a new one, and it is never presented as evidence.
 *
 * Free of Node imports: the Lab is a client surface and this runs there.
 */

import type { LabRecordField, LabRecordView, RecordFieldKey } from "./record-view.js";
import type { RecordCheck } from "./record-checks.js";

export interface ExplanationLine {
  text: string;
  origin: "record" | "editorial";
}

export interface ExplanationSection {
  id: string;
  heading: string;
  lines: readonly ExplanationLine[];
  /** The fields this section is about. Hovering one highlights it everywhere. */
  fields: readonly RecordFieldKey[];
}

/**
 * Lowercase the first letter only, and not even that when the value opens with
 * an initialism. `toLowerCase()` on the whole string would flatten "AI" to "ai";
 * lowering the first character alone would turn "AI lifecycle organization" into
 * "aI lifecycle organization". Both are the humanizer's work being undone.
 */
function lower(text: string): string {
  if (/^[A-Z]{2,}/.test(text)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** For a sentence that opens with a field label rather than a word. */
function upper(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const fromRecord = (text: string): ExplanationLine => ({ text, origin: "record" });
const fromEditor = (text: string): ExplanationLine => ({ text, origin: "editorial" });

function pick(view: LabRecordView, keys: readonly RecordFieldKey[]): LabRecordField[] {
  return keys
    .map((key) => view.fields.find((field) => field.key === key))
    .filter((field): field is LabRecordField => field !== undefined);
}

function byGroup(view: LabRecordView, group: LabRecordField["group"]): LabRecordField[] {
  return view.fields.filter((field) => field.group === group);
}

function value(view: LabRecordView, key: RecordFieldKey): string | undefined {
  return view.fields.find((field) => field.key === key)?.value;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function labExplanationSections(
  view: LabRecordView,
  checks: readonly RecordCheck[],
): readonly ExplanationSection[] {
  const sections: ExplanationSection[] = [];

  /* ------------------------------------------------------------ record type */
  sections.push({
    id: "record-type",
    heading: "Record type",
    lines: [
      fromRecord(
        `The reviewers recorded this as ${lower(value(view, "record_type") ?? view.recordType)}, from ${view.instrument}, ${view.sourceLocator}.`,
      ),
      fromEditor(view.explanation.reading),
    ],
    fields: byGroup(view, "identity").map((field) => field.key),
  });

  /* --------------------------------------------------------- who is involved */
  const actors = byGroup(view, "actor");
  if (actors.length > 0) {
    const lines: ExplanationLine[] = [];
    const actor = value(view, "actor_type");
    const term = value(view, "actor_term_local");
    if (actor) {
      lines.push(
        fromRecord(
          term
            ? `It is addressed to ${lower(actor)}, which the source calls “${term}”.`
            : `It is addressed to ${lower(actor)}.`,
        ),
      );
    }
    // A proposal names who acts now and who would be reached if it were adopted.
    const current = value(view, "current_actor_type");
    const prospective = value(view, "prospective_actor_type");
    if (current || prospective) {
      lines.push(
        fromRecord(
          `${current ? `${current} acts now` : "No actor acts now"}${
            prospective ? `, and ${lower(prospective)} would be reached if it were adopted` : ""
          }.`,
        ),
      );
    }
    const recipient = value(view, "recipient_actor_type");
    if (recipient) lines.push(fromRecord(`It runs to ${lower(recipient)}.`));
    const excluded = value(view, "excluded_direct_actor_types");
    if (excluded) lines.push(fromRecord(`It explicitly does not reach ${lower(excluded)}.`));
    const defined = value(view, "defined_actor_class");
    if (defined && !actor) lines.push(fromRecord(`It applies to a defined class: ${defined}.`));

    if (lines.length > 0) {
      sections.push({
        id: "actors",
        heading: "Who is involved",
        lines,
        fields: actors.map((field) => field.key),
      });
    }
  }

  /* ------------------------------------------- what the passage establishes */
  const conduct = byGroup(view, "conduct");
  if (conduct.length > 0) {
    const lines: ExplanationLine[] = [];
    const type = value(view, "conduct_type");
    const term = value(view, "conduct_term_local");
    if (type) {
      lines.push(
        fromRecord(
          term
            ? `The conduct classified is ${lower(type)}: “${term}”.`
            : `The conduct classified is ${lower(type)}.`,
        ),
      );
    } else {
      lines.push(
        fromRecord(
          `No conduct is classified. A record of this type does not require an action of its own.`,
        ),
      );
    }
    const object = value(view, "target_system");
    if (object) lines.push(fromRecord(`It is about ${lower(object)}.`));
    const proposal = value(view, "proposal_action");
    if (proposal) lines.push(fromRecord(`The action proposed is to ${proposal}.`));
    const scope = value(view, "scope") ?? value(view, "covered_scope");
    if (scope) lines.push(fromRecord(`Its scope is recorded as ${lower(scope)}.`));

    sections.push({
      id: "conduct",
      heading: "What the passage establishes",
      lines,
      fields: conduct.map((field) => field.key),
    });
  }

  /* ------------------------------------------------- authority or conditions */
  const authority = byGroup(view, "authority");
  const conditions = byGroup(view, "conditions");
  if (authority.length > 0 || conditions.length > 0) {
    const lines: ExplanationLine[] = [];
    const named = pick(view, [
      "responsible_authority",
      "responsible_authorities",
      "implementation_body",
      "additional_authority",
      "potential_responsible_authorities",
      "policy_authority",
      "policy_origin",
    ]);
    if (named.length > 0) {
      lines.push(
        fromRecord(`Responsibility is recorded with ${list(named.map((field) => field.value))}.`),
      );
    }
    const excepted = value(view, "exception_target");
    if (excepted) lines.push(fromRecord(`It lifts ${lower(excepted)}.`));
    const conditionStatus = value(view, "exception_conditions_status");
    // Quoted, because the reviewers' own wording ends without punctuation and
    // must not be tidied into a sentence that reads as ours.
    if (conditionStatus) lines.push(fromRecord(`On conditions: “${conditionStatus}”.`));
    const consequence = value(view, "noncompliance_consequence");
    if (consequence) {
      lines.push(
        fromRecord(`The recorded consequence of non-compliance is ${lower(consequence)}.`),
      );
    }
    const indicators = value(view, "classification_indicators");
    if (indicators) lines.push(fromRecord(`Classification indicators: ${indicators}.`));

    if (lines.length > 0) {
      sections.push({
        id: "authority",
        heading: "Authority or conditions",
        lines,
        fields: [...authority, ...conditions].map((field) => field.key),
      });
    }
  }

  /* --------------------------------------------------------------- evidence */
  const evidenceLines: ExplanationLine[] = [];
  if (view.source.state === "unresolved") {
    evidenceLines.push(
      fromRecord(
        `No source document is registered for this instrument, so the classification has not been checked against retrieved text.`,
      ),
    );
  } else {
    const doc = view.source.document;
    evidenceLines.push(
      fromRecord(
        doc
          ? `The classification rests on a passage retrieved from ${doc.title}${
              view.source.locator ? `, ${view.source.locator}` : ""
            }, published by ${doc.publisher}.`
          : `The classification rests on a retrieved passage.`,
      ),
    );
    if (view.source.state === "inherited") {
      evidenceLines.push(
        fromRecord(
          `That passage was recorded against ${view.source.passageRowId}, the bundle this record was derived from.`,
        ),
      );
    }
  }
  if (view.explanation.reviewerNote.text) {
    evidenceLines.push(
      fromRecord(
        `The reviewers’ own note${view.explanation.reviewerNote.inherited ? ", recorded against the parent bundle" : ""}: ${view.explanation.reviewerNote.text}`,
      ),
    );
  }
  sections.push({
    id: "evidence",
    heading: "Supporting evidence",
    lines: evidenceLines,
    fields: [],
  });

  /* -------------------------------------------------- unknown or unrecorded */
  const unknownFields = view.fields.filter((field) => field.isUnknown);
  const missing = checks.filter((check) => check.state === "not_recorded");
  const uncertaintyLines: ExplanationLine[] = [];
  if (unknownFields.length > 0) {
    uncertaintyLines.push(
      fromRecord(
        upper(
          `${list(unknownFields.map((field) => lower(field.label)))} ${unknownFields.length === 1 ? "is" : "are"} recorded as unknown. That is a judgment about the evidence, not a gap to be filled in later.`,
        ),
      ),
    );
  }
  for (const check of missing) {
    uncertaintyLines.push(
      fromRecord(
        // The reason is the registry's own wording and is not recased.
        check.note
          ? `${check.label} is not recorded: ${check.note}`
          : `${check.label} is not recorded.`,
      ),
    );
  }
  if (uncertaintyLines.length === 0) {
    uncertaintyLines.push(fromRecord("Every condition the reviewers tracked is recorded."));
  }
  sections.push({
    id: "uncertainty",
    heading: "What remains unknown or disputed",
    lines: uncertaintyLines,
    fields: unknownFields.map((field) => field.key),
  });

  /* ---------------------------------------------------- why it matters */
  sections.push({
    id: "distinction",
    heading: "Why this distinction matters",
    lines: [fromEditor(view.explanation.limit), fromEditor(view.explanation.why)],
    fields: [...byGroup(view, "force"), ...byGroup(view, "lifecycle")].map((field) => field.key),
  });

  return sections;
}
