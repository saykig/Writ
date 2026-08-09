/**
 * What holds together in one record, said plainly.
 *
 * This replaces the score-program summary that used to sit above the Lab. It
 * reports conditions a reader can act on — is the record linked to a passage, is
 * an actor named, is the conduct classified — and it reports them as states, not
 * as a mark out of seven. There is no score here and there must not be one: a
 * record with an unresolved enforcement status is not a worse record, it is a
 * record whose reviewers declined to guess.
 *
 * Four states, and the distinctions between them are the whole point:
 *
 *   - `recorded` — the reviewers filled this in;
 *   - `inherited` — it comes from the bundle this record was derived from, which
 *     the reader is told rather than left to infer;
 *   - `recorded_unknown` — the reviewers recorded `unknown`, which is a judgment
 *     about the evidence and not a blank;
 *   - `not_recorded` — nothing was recorded. Not a failure, and never coloured
 *     like one.
 *
 * The input is structural rather than tied to a finished view, so shared record
 * readers receive the same seven answers the Lab gives.
 */

import type { ClaimFields } from "./demo-analysis-format.js";
import { humanize } from "./demo-analysis-format.js";
import type { SourceState } from "./record-view.js";

export type CheckState = "recorded" | "inherited" | "recorded_unknown" | "not_recorded";

export type CheckKey =
  "source" | "actor" | "conduct" | "force" | "applicability" | "enforcement" | "reviewer_note";

export interface RecordCheck {
  key: CheckKey;
  /** The question this answers, in ordinary words. */
  label: string;
  state: CheckState;
  /** What the record says. `null` where the state carries the whole answer. */
  value: string | null;
  /** Why, in the record's own terms. Never an editorial judgment. */
  note: string | null;
}

export interface RecordCheckInput {
  fields: Partial<ClaimFields>;
  source: {
    state: SourceState;
    passageRowId: string | null;
    unresolvedReason: string | null;
  };
  interpretation: { text: string; inherited: boolean };
}

const LABELS: Record<CheckKey, string> = {
  source: "Source passage",
  actor: "Actor",
  conduct: "Claim or conduct",
  force: "Legal force",
  applicability: "Applicability",
  enforcement: "Enforcement",
  reviewer_note: "Reviewer’s note",
};

function joinNotes(parts: (string | null | undefined)[]): string | null {
  const kept = parts.filter((part): part is string => Boolean(part && part.trim()));
  return kept.length ? kept.join(" ") : null;
}

/** Trims the reviewers' folded scalars without altering their wording. */
function tidy(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : undefined;
}

function sourceCheck(input: RecordCheckInput): RecordCheck {
  const { state, passageRowId, unresolvedReason } = input.source;
  if (state === "unresolved") {
    return {
      key: "source",
      label: LABELS.source,
      state: "not_recorded",
      value: null,
      note: unresolvedReason ?? "No source document is registered for this instrument.",
    };
  }
  if (state === "inherited") {
    return {
      key: "source",
      label: LABELS.source,
      state: "inherited",
      value: passageRowId,
      note: `The passage was recorded against ${passageRowId ?? "the parent bundle"}, which this record was derived from.`,
    };
  }
  return {
    key: "source",
    label: LABELS.source,
    state: "recorded",
    value: passageRowId,
    note: null,
  };
}

function actorCheck(fields: Partial<ClaimFields>): RecordCheck {
  const term = tidy(fields.actor_term_local) ?? tidy(fields.target_actor);
  if (fields.actor_type) {
    return {
      key: "actor",
      label: LABELS.actor,
      state: "recorded",
      value: humanize(fields.actor_type),
      note: term ? `The source’s own term: “${term}”.` : null,
    };
  }
  // A record about a proposal names who acts now and who would be reached later,
  // rather than a single addressee. Reporting that as "no actor" would be wrong.
  const current = fields.current_actor_type ? humanize(fields.current_actor_type) : null;
  const prospective = fields.prospective_actor_type
    ? humanize(fields.prospective_actor_type)
    : null;
  if (current || prospective) {
    return {
      key: "actor",
      label: LABELS.actor,
      state: "recorded",
      value: [current, prospective].filter(Boolean).join(" → "),
      note: joinNotes([
        current ? `Acting now: ${tidy(fields.current_actor_term_local) ?? current}.` : null,
        prospective
          ? `Would be reached: ${tidy(fields.prospective_actor_term_local) ?? prospective}.`
          : null,
      ]),
    };
  }
  return { key: "actor", label: LABELS.actor, state: "not_recorded", value: null, note: null };
}

function conductCheck(fields: Partial<ClaimFields>): RecordCheck {
  if (fields.conduct_type) {
    const term = tidy(fields.conduct_term_local);
    return {
      key: "conduct",
      label: LABELS.conduct,
      state: "recorded",
      value: humanize(fields.conduct_type),
      note: term ? `The source’s own term: “${term}”.` : null,
    };
  }
  return {
    key: "conduct",
    label: LABELS.conduct,
    state: "not_recorded",
    value: null,
    // An exception or a scope rule classifies no conduct of its own. Saying which
    // kind of record it is keeps that from reading as an omission.
    note: fields.record_type ? `Record type: ${humanize(fields.record_type)}.` : null,
  };
}

function forceCheck(fields: Partial<ClaimFields>): RecordCheck {
  if (!fields.legal_force) {
    return { key: "force", label: LABELS.force, state: "not_recorded", value: null, note: null };
  }
  if (fields.legal_force === "unknown") {
    return {
      key: "force",
      label: LABELS.force,
      state: "recorded_unknown",
      value: "unknown",
      note: null,
    };
  }
  return {
    key: "force",
    label: LABELS.force,
    state: "recorded",
    value: humanize(fields.legal_force),
    note: joinNotes([
      fields.binding_scope ? `Binds ${fields.binding_scope.replace(/_/g, " ")}.` : null,
      // A voluntary path into a binding regime is the classification most often
      // collapsed, so both halves are stated together or not at all.
      fields.underlying_regime_force && fields.underlying_instrument
        ? `The regime it demonstrates compliance with is ${fields.underlying_regime_force}: ${fields.underlying_instrument.replace(/_/g, " ")}.`
        : null,
      fields.source_legal_force_label && fields.source_legal_force_label !== fields.legal_force
        ? `Recorded in the source as ${fields.source_legal_force_label.replace(/_/g, " ")}.`
        : null,
    ]),
  };
}

function statusCheck(
  key: "applicability" | "enforcement",
  raw: string | undefined,
  note: string | null = null,
): RecordCheck {
  if (raw === undefined) {
    return { key, label: LABELS[key], state: "not_recorded", value: null, note };
  }
  if (raw === "unknown") {
    return { key, label: LABELS[key], state: "recorded_unknown", value: "unknown", note };
  }
  return { key, label: LABELS[key], state: "recorded", value: humanize(raw), note };
}

function reviewerNoteCheck(input: RecordCheckInput): RecordCheck {
  const text = input.interpretation.text.trim();
  if (!text) {
    return {
      key: "reviewer_note",
      label: LABELS.reviewer_note,
      state: "not_recorded",
      value: null,
      note: null,
    };
  }
  return {
    key: "reviewer_note",
    label: LABELS.reviewer_note,
    state: input.interpretation.inherited ? "inherited" : "recorded",
    value: null,
    note: input.interpretation.inherited
      ? "Recorded against the parent bundle rather than this record."
      : null,
  };
}

/** Always seven checks, in this order, so the list never reflows between records. */
export function recordChecks(input: RecordCheckInput): readonly RecordCheck[] {
  const { fields } = input;
  return [
    sourceCheck(input),
    actorCheck(fields),
    conductCheck(fields),
    forceCheck(fields),
    statusCheck(
      "applicability",
      fields.applicability_status,
      fields.adoption_status ? `Adoption: ${humanize(fields.adoption_status)}.` : null,
    ),
    statusCheck("enforcement", fields.enforcement_status),
    reviewerNoteCheck(input),
  ];
}

/**
 * One sentence over the seven, for the header of the status block.
 *
 * Counts what is unresolved rather than what is complete, because the reader's
 * question is what is missing, not how well the record scored.
 */
export function checksSummary(checks: readonly RecordCheck[]): string {
  const unknown = checks.filter((check) => check.state === "recorded_unknown");
  const missing = checks.filter((check) => check.state === "not_recorded");
  const parts: string[] = [];
  if (unknown.length === 1) parts.push("One value is recorded as unknown.");
  else if (unknown.length > 1) parts.push(`${unknown.length} values are recorded as unknown.`);
  if (missing.length === 1) parts.push("One is not recorded.");
  else if (missing.length > 1) parts.push(`${missing.length} are not recorded.`);
  if (parts.length === 0) return "Every condition below is recorded.";
  return parts.join(" ");
}
