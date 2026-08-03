/**
 * A draft record, held in the browser.
 *
 * The Builder exists to show that a source passage can become a structured
 * record without anyone writing YAML. It stops there. A draft is never
 * published, never opened as a contribution, never written to the repository —
 * it lives in this browser and nowhere else, and the vocabulary it offers is
 * read off the reviewed corpus rather than invented for the form.
 *
 * Pure and free of React so the same functions can be tested directly and run
 * over a draft on the way into `recordChecks`.
 */

import type { ClaimFields } from "./demo-analysis-format.js";
import { renderRecordYaml, type RenderedYaml, type YamlLine } from "./record-yaml.js";

export const DRAFT_STORAGE_KEY = "writ:build-draft";
export const DRAFT_VERSION = 1;

/** The families the form adapts to. A legal-force group is meaningless outside policy. */
export const CORPUS_FAMILIES = ["policy", "empirical", "theoretical"] as const;
export type CorpusFamily = (typeof CORPUS_FAMILIES)[number];

export const BUILD_STEPS = [
  { id: "corpus", title: "Define corpus" },
  { id: "source", title: "Add source" },
  { id: "passage", title: "Select passage" },
  { id: "record", title: "Review record" },
  { id: "validate", title: "Validate" },
] as const;

export type BuildStepId = (typeof BUILD_STEPS)[number]["id"];

export interface CorpusDraft {
  name: string;
  subject: string;
  jurisdiction: string;
  periodFrom: string;
  periodTo: string;
  family: CorpusFamily;
  description: string;
}

export interface SourceDraft {
  title: string;
  institution: string;
  date: string;
  url: string;
  passage: string;
}

export interface RecordDraft {
  recordType: string;
  actorType: string;
  actorTerm: string;
  conductType: string;
  conductTerm: string;
  object: string;
  authority: string;
  conditions: string;
  legalForce: string;
  adoption: string;
  applicability: string;
  enforcement: string;
  /** The confirmed span of the pasted passage this record rests on. */
  evidence: string;
  uncertainty: string;
}

export interface BuildDraft {
  version: number;
  corpus: CorpusDraft;
  source: SourceDraft;
  record: RecordDraft;
  /** Character span the user confirmed in step 3, or `null` for the whole passage. */
  selection: { start: number; end: number } | null;
  savedAt: string | null;
}

export function emptyDraft(): BuildDraft {
  return {
    version: DRAFT_VERSION,
    corpus: {
      name: "",
      subject: "",
      jurisdiction: "",
      periodFrom: "",
      periodTo: "",
      family: "policy",
      description: "",
    },
    source: { title: "", institution: "", date: "", url: "", passage: "" },
    record: {
      recordType: "",
      actorType: "",
      actorTerm: "",
      conductType: "",
      conductTerm: "",
      object: "",
      authority: "",
      conditions: "",
      legalForce: "",
      adoption: "",
      applicability: "",
      enforcement: "",
      evidence: "",
      uncertainty: "",
    },
    selection: null,
    savedAt: null,
  };
}

/**
 * Parse a stored draft, or start again.
 *
 * A version mismatch discards rather than migrates: a half-migrated draft that
 * silently changes what a field meant is worse than an empty form.
 */
export function decodeDraft(raw: string | null): BuildDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BuildDraft>;
    if (parsed?.version !== DRAFT_VERSION) return null;
    const base = emptyDraft();
    return {
      version: DRAFT_VERSION,
      corpus: { ...base.corpus, ...(parsed.corpus ?? {}) },
      source: { ...base.source, ...(parsed.source ?? {}) },
      record: { ...base.record, ...(parsed.record ?? {}) },
      selection: parsed.selection ?? null,
      savedAt: parsed.savedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function encodeDraft(draft: BuildDraft): string {
  return JSON.stringify(draft);
}

/** The passage span the record rests on: the confirmed selection, or the whole text. */
export function selectedPassage(draft: BuildDraft): string {
  const { passage } = draft.source;
  if (!draft.selection) return passage;
  return passage.slice(draft.selection.start, draft.selection.end);
}

/** Whether the legal-force group applies at all. */
export function needsLegalForce(draft: BuildDraft): boolean {
  return draft.corpus.family === "policy";
}

/**
 * The draft in the reviewed corpus's own field names, so the Builder's validation
 * is the same function the Lab runs rather than a second implementation of it.
 * Empty strings are dropped, because an untouched field is not a recorded value.
 */
export function draftToClaimFields(draft: BuildDraft): Partial<ClaimFields> {
  const { record } = draft;
  const set = (value: string) => (value.trim() ? value.trim() : undefined);
  const legal = needsLegalForce(draft);
  return {
    record_type: set(record.recordType) ?? "",
    actor_type: set(record.actorType),
    actor_term_local: set(record.actorTerm),
    conduct_type: set(record.conductType),
    conduct_term_local: set(record.conductTerm),
    target_system: set(record.object),
    responsible_authority: set(record.authority),
    ...(legal
      ? {
          legal_force: set(record.legalForce),
          adoption_status: set(record.adoption),
          applicability_status: set(record.applicability),
          enforcement_status: set(record.enforcement),
        }
      : {}),
  };
}

/** The draft's source, shaped for `recordChecks`. A draft has no source registry. */
export function draftSourceState(draft: BuildDraft): {
  state: "direct" | "unresolved";
  passageRowId: string | null;
  unresolvedReason: string | null;
} {
  if (selectedPassage(draft).trim()) {
    return {
      state: "direct",
      passageRowId: draft.source.title.trim() || null,
      unresolvedReason: null,
    };
  }
  return {
    state: "unresolved",
    passageRowId: null,
    unresolvedReason: "No source passage has been entered for this draft.",
  };
}

/**
 * The draft as structured output.
 *
 * Corpus field names where the draft maps onto one, and a clearly separated
 * block for the three the reviewed schema has no single field for. Labelling
 * them as draft notes keeps the Builder from teaching a field that does not
 * exist in the corpus.
 */
export function draftToYaml(draft: BuildDraft): RenderedYaml {
  const { record, corpus, source } = draft;
  const entries: YamlLine[] = [];
  const push = (key: string, value: string) => {
    if (value.trim()) entries.push({ key, value: value.trim() });
  };

  push("corpus", corpus.name);
  push("corpus_family", corpus.family);
  push("jurisdiction", corpus.jurisdiction);
  push("source_title", source.title);
  push("source_institution", source.institution);
  push("source_date", source.date);
  push("source_uri", source.url);
  push("record_type", record.recordType);
  push("actor_type", record.actorType);
  push("actor_term_local", record.actorTerm);
  push("conduct_type", record.conductType);
  push("conduct_term_local", record.conductTerm);
  push("target_system", record.object);
  push("responsible_authority", record.authority);
  if (needsLegalForce(draft)) {
    push("legal_force", record.legalForce);
    push("adoption_status", record.adoption);
    push("applicability_status", record.applicability);
    push("enforcement_status", record.enforcement);
  }
  push("quote", selectedPassage(draft));

  const notes: YamlLine[] = [];
  const pushNote = (key: string, value: string) => {
    if (value.trim()) notes.push({ key, value: value.trim() });
  };
  pushNote("conditions", record.conditions);
  pushNote("evidence", record.evidence);
  pushNote("uncertainty", record.uncertainty);

  const header = [
    "Draft record — not published, not part of any corpus.",
    "Field names follow the reviewed corpus where the draft maps onto one.",
  ];
  if (notes.length) {
    return renderRecordYaml(header, [
      ...entries,
      { comment: "draft notes — the reviewed schema has no single field for these" },
      ...notes,
    ]);
  }
  return renderRecordYaml(header, entries);
}
