/**
 * The Demo's memo builder.
 *
 * A memo is a rendering of the reviewed records, not a new analysis of them.
 * Every sentence below is assembled from fields the reviewers filled in: which
 * actor class a rule names, which conduct it requires, how strongly it binds,
 * and whether it is in force. The reviewers' own interpretation note and the
 * verbatim source excerpt travel with each citation, so any sentence can be
 * checked against the record it came from.
 *
 * Three rules govern this file:
 *
 *   1. No sentence asserts anything the selected records do not record. Counts,
 *      groupings and citations are computed; the connecting words come from the
 *      fixed vocabulary in `demo-prose.ts`.
 *   2. The four dimensions stay separate. Legal force is never merged with
 *      compliance function, and adoption, applicability and enforcement are
 *      reported as three answers rather than one.
 *   3. `unknown` is stated as unknown. A record that does not say how a measure
 *      is enforced is reported that way, never as unenforceable.
 *
 * The same question over the same reviewed data therefore produces the same
 * memo, which is the property that makes it worth citing.
 */

import {
  policyTestClaimRecords,
  policyTestDataset,
  type ClaimFields,
  type ClaimRecord,
} from "./policy-test.js";
import { sourceFor } from "./pilot-sources.js";
import { humanize, instrumentLabel } from "./policy-test-format.js";
import {
  ADJACENT_TO_EVALUATION,
  actorPhrase,
  adoptionPhrase,
  agree,
  applicabilityPhrase,
  conductPhrase,
  count,
  enforcementPhrase,
  forcePhrase,
  functionPhrase,
  joinList,
  scopeBoundary,
  sentence,
  targetPhrase,
} from "./demo-prose.js";

/* --------------------------------------------------------------- the model */

/** One labelled value of the underlying record, shown behind a control. */
export interface StructuredField {
  label: string;
  /** `null` where the reviewers recorded nothing; `unknown` is a real value. */
  value: string | null;
}

export interface MemoFootnote {
  n: number;
  claimId: string;
  /** The reviewed fields this record was cited for, named for the reader. */
  supportingFields: string[];
  jurisdiction: "EU" | "US";
  instrument: string;
  sourceLocator: string;
  /** The retrieved document, when the row has been traced to one. */
  document?: { title: string; uri: string; anchor: string; retrievedAt: string };
  /** The document's own words. Absent when the row is not yet traced. */
  excerpt?: string;
  /** The reviewers' note on the record. */
  interpretation: string;
  legalForce: string;
  applicabilityStatus: string;
  adoptionStatus: string;
  /** Raw, so `unknown` reaches the reader as `unknown`. */
  enforcementStatus: string;
  structured: StructuredField[];
}

/** A sentence and the records it rests on. */
export interface MemoSentence {
  text: string;
  notes: number[];
}

export interface MemoSection {
  id: string;
  heading: string;
  /** One line on what this dimension asks, shown under the heading. */
  purpose: string;
  paragraphs: MemoSentence[][];
}

export interface Memo {
  questionId: string;
  question: string;
  title: string;
  kind: string;
  datasetId: string;
  profileId: string;
  executive: MemoSentence[];
  sections: MemoSection[];
  conclusion: MemoSentence[];
  footnotes: MemoFootnote[];
  /** How much of the reviewed corpus this memo drew on, and what it left out. */
  coverage: {
    selected: number;
    corpus: number;
    untraced: string[];
    documents: number;
  };
}

/* ---------------------------------------------------------------- footnotes */

const PROFILE_ID = "profile-eu-us-ai-evaluation-reviewed";

/** Field labels for the structured record shown beneath each footnote. */
const STRUCTURED_LABELS: [keyof ClaimFields, string][] = [
  ["record_type", "record_type"],
  ["actor_type", "actor_type"],
  ["actor_term_local", "actor_term_local"],
  ["conduct_type", "conduct_type"],
  ["conduct_term_local", "conduct_term_local"],
  ["target_system", "target_system"],
  ["legal_force", "legal_force"],
  ["compliance_function", "compliance_function"],
  ["binding_scope", "binding_scope"],
  ["adoption_status", "adoption_status"],
  ["applicability_status", "applicability_status"],
  ["enforcement_status", "enforcement_status"],
  ["headline_relevance", "headline_relevance"],
];

function structuredFields(fields: ClaimFields): StructuredField[] {
  return STRUCTURED_LABELS.map(([key, label]) => {
    const raw = fields[key];
    const value = Array.isArray(raw) ? raw.join(", ") : (raw ?? null);
    return { label, value: typeof value === "string" ? value : null };
  });
}

/**
 * Assigns footnote numbers as the memo is written: one per reviewed record, in
 * the order a reader first meets it. A record cited in several sections keeps
 * the same number and accumulates the fields it was cited for, so the note can
 * say which parts of the record the memo leaned on without the reader wading
 * through a separate note per field.
 */
class Footnotes {
  private readonly index = new Map<string, number>();
  readonly list: MemoFootnote[] = [];

  cite(claim: ClaimRecord, supportingField: string): number {
    const existing = this.index.get(claim.claimId);
    if (existing !== undefined) {
      const note = this.list[existing - 1];
      if (!note.supportingFields.includes(supportingField)) {
        note.supportingFields.push(supportingField);
      }
      return existing;
    }

    const n = this.list.length + 1;
    this.index.set(claim.claimId, n);

    const sourced = sourceFor(claim.claimId) ?? sourceFor(claim.parentRowId);
    this.list.push({
      n,
      claimId: claim.claimId,
      supportingFields: [supportingField],
      jurisdiction: claim.jurisdiction,
      instrument: instrumentLabel(claim.instrument),
      sourceLocator: claim.sourceLocator,
      ...(sourced
        ? {
            document: {
              title: sourced.document.title,
              uri: sourced.document.uri,
              anchor: sourced.anchor,
              retrievedAt: sourced.document.retrieved_at.slice(0, 10),
            },
            excerpt: sourced.passage.quote,
          }
        : {}),
      interpretation: claim.interpretationNote.trim(),
      legalForce: claim.fields.legal_force ?? "not recorded",
      applicabilityStatus: claim.fields.applicability_status ?? "not recorded",
      adoptionStatus: claim.fields.adoption_status ?? "not recorded",
      enforcementStatus: claim.fields.enforcement_status ?? "not recorded",
      structured: structuredFields(claim.fields),
    });
    return n;
  }

  /** Ascending and deduplicated, so a citation run reads as "1, 3–5". */
  citeAll(claims: readonly ClaimRecord[], supportingField: string): number[] {
    const numbers = claims.map((claim) => this.cite(claim, supportingField));
    return [...new Set(numbers)].sort((a, b) => a - b);
  }
}

/* ----------------------------------------------------------------- grouping */

interface Group {
  value: string;
  claims: ClaimRecord[];
}

/**
 * Group the selected records by one coded field, largest group first, with a
 * stable tie-break so the same question always produces the same memo.
 */
function groupBy(claims: readonly ClaimRecord[], field: keyof ClaimFields): Group[] {
  const buckets = new Map<string, ClaimRecord[]>();
  for (const claim of claims) {
    const raw = claim.fields[field];
    if (typeof raw !== "string") continue;
    const bucket = buckets.get(raw);
    if (bucket) bucket.push(claim);
    else buckets.set(raw, [claim]);
  }
  return [...buckets.entries()]
    .map(([value, list]) => ({ value, claims: list }))
    .sort((a, b) => b.claims.length - a.claims.length || a.value.localeCompare(b.value));
}

const has = (claims: readonly ClaimRecord[], field: keyof ClaimFields, value: string) =>
  claims.filter((claim) => claim.fields[field] === value);

/* ------------------------------------------------------------ the questions */

interface BuildContext {
  selected: ClaimRecord[];
  corpus: ClaimRecord[];
  notes: Footnotes;
}

export interface QuestionConfig {
  id: string;
  /** The question as the user chooses it. */
  question: string;
  /** The memo's own title. */
  title: string;
  /** The kind of analysis, kept visually secondary in the picker. */
  kind: string;
  /** One line describing what the memo will examine. */
  description: string;
  /** Which reviewed records this question draws on. */
  select: (claims: readonly ClaimRecord[]) => ClaimRecord[];
  executive: (context: BuildContext) => MemoSentence[];
  conclusion: (context: BuildContext) => MemoSentence[];
}

/** Conduct that the evaluation-trigger question turns on. */
const EVALUATION_CONDUCT = [
  "model_evaluation",
  "pre_deployment_testing",
  "procurement_testing",
  "evaluation_access",
] as const;

/** Records that set or qualify when an obligation bites. */
const LIFECYCLE_RELEVANCE = [
  "defines_scope",
  "scope_activation_support",
  "establishes_current_applicability",
  "qualifies_current_applicability",
  "excludes_general_provider_duty",
] as const;

const QUESTIONS: QuestionConfig[] = [
  {
    id: "evaluation-trigger",
    question: "When does AI evaluation become a legal requirement?",
    title: "Conditions under which AI evaluation becomes a legal requirement",
    kind: "Regulatory trigger",
    description:
      "Which actor, which class of model, and which conditions have to hold before an evaluation duty applies.",
    select: (claims) =>
      claims.filter(
        (claim) =>
          EVALUATION_CONDUCT.includes(claim.fields.conduct_type as never) ||
          LIFECYCLE_RELEVANCE.includes(claim.fields.headline_relevance as never),
      ),
    executive: ({ selected, notes }) => {
      const evaluation = has(selected, "conduct_type", "model_evaluation");
      const binding = evaluation.filter(
        (claim) =>
          claim.fields.legal_force === "binding" &&
          claim.fields.applicability_status === "applicable",
      );
      const sentences: MemoSentence[] = [
        {
          text: `Of the records selected for this question, ${count(evaluation.length, "provision")} ${agree(evaluation.length, "requires", "require")} an actor to perform model evaluation itself.`,
          notes: notes.citeAll(evaluation, "conduct_type"),
        },
      ];
      if (binding.length > 0) {
        const targets = [
          ...new Set(binding.map((claim) => targetPhrase(claim.fields.target_system) ?? "")),
        ].filter(Boolean);
        sentences.push({
          text: sentence(
            `${count(binding.length, "of those", "of those")} ${agree(binding.length, "is", "are")} binding and currently in force${targets.length ? `, and ${agree(binding.length, "it reaches", "they reach")} ${joinList(targets)}` : ""}.`,
          ),
          notes: notes.citeAll(binding, "legal_force"),
        });
      } else {
        sentences.push({
          text: "None of those is both binding and currently in force.",
          notes: [],
        });
      }
      return sentences;
    },
    conclusion: ({ selected, notes }) => {
      const qualifying = selected.filter(
        (claim) =>
          claim.fields.conduct_type === "model_evaluation" &&
          claim.fields.legal_force === "binding" &&
          claim.fields.actor_type === "market_provider" &&
          claim.fields.applicability_status === "applicable",
      );
      if (qualifying.length === 0) {
        return [
          {
            text: "On the reviewed record, no selected provision requires a market provider to perform model evaluation under a binding rule that currently applies.",
            notes: [],
          },
        ];
      }
      const targets = [
        ...new Set(qualifying.map((claim) => targetPhrase(claim.fields.target_system) ?? "")),
      ].filter(Boolean);
      return [
        {
          text: `Evaluation becomes a legal requirement at the point where all four conditions hold together: the actor is a provider placing a model on the market, the conduct required is model evaluation itself rather than a neighbouring duty, the measure binds, and it is already in force.`,
          notes: [],
        },
        {
          text: `On the reviewed record that point is reached by ${count(qualifying.length, "provision")}${targets.length ? `, and only for ${joinList(targets)}` : ""}.`,
          notes: notes.citeAll(qualifying, "headline_relevance"),
        },
        {
          text: "Every other selected provision fails at least one of the four conditions, which is why a duty that looks adjacent to evaluation does not carry the same consequence.",
          notes: [],
        },
      ];
    },
  },
  {
    id: "voluntary-and-binding",
    question: "How do voluntary standards operate alongside binding AI evaluation rules?",
    title: "The relationship between voluntary standards and binding evaluation rules",
    kind: "Relationship between soft and binding law",
    description:
      "Where voluntary guidance sits next to a binding obligation, and where it is recognised as a way of meeting one.",
    select: (claims) =>
      claims.filter(
        (claim) =>
          claim.fields.legal_force !== "binding" ||
          claim.fields.compliance_function === "recognized_compliance_path" ||
          claim.fields.conduct_type === "model_evaluation",
      ),
    executive: ({ selected, notes }) => {
      const voluntary = has(selected, "legal_force", "voluntary");
      const paths = has(selected, "compliance_function", "recognized_compliance_path");
      const sentences: MemoSentence[] = [
        {
          text: `The selected records include ${count(voluntary.length, "voluntary measure")} alongside the binding obligations they sit next to.`,
          notes: notes.citeAll(voluntary, "legal_force"),
        },
      ];
      if (paths.length > 0) {
        sentences.push({
          text: sentence(
            `${count(paths.length, "of them", "of them")} ${agree(paths.length, "is", "are")} recorded as a recognised way of demonstrating compliance with a separate binding obligation, which is a statement about function and not about force.`,
          ),
          notes: notes.citeAll(paths, "compliance_function"),
        });
      }
      return sentences;
    },
    conclusion: ({ selected, notes }) => {
      const voluntary = has(selected, "legal_force", "voluntary");
      const paths = has(selected, "compliance_function", "recognized_compliance_path");
      const proposed = has(selected, "legal_force", "proposed");
      const sentences: MemoSentence[] = [
        {
          text: "Voluntary standards in the reviewed corpus operate beside binding rules rather than inside them. Their legal force and their compliance function are recorded separately, and the second does not change the first.",
          notes: [],
        },
      ];
      if (paths.length > 0) {
        sentences.push({
          text: `Where a voluntary measure is a recognised compliance path, following it is a way of showing that a binding obligation has been met; it does not make the voluntary measure itself enforceable.`,
          notes: notes.citeAll(paths, "compliance_function"),
        });
      }
      sentences.push({
        text: sentence(
          `${count(voluntary.length, "voluntary measure")} ${agree(voluntary.length, "carries", "carry")} no obligation of ${agree(voluntary.length, "its", "their")} own on the reader${proposed.length ? `, and ${count(proposed.length, "further measure")} ${agree(proposed.length, "remains", "remain")} proposed rather than adopted` : ""}.`,
        ),
        notes: notes.citeAll(proposed, "adoption_status"),
      });
      return sentences;
    },
  },
  {
    id: "institutional-design",
    question:
      "Where does current AI policy rely on public institutions rather than private-provider regulation?",
    title: "Public institutions and private-provider regulation in current AI policy",
    kind: "Institutional design",
    description:
      "Whether evaluation governance runs through rules on providers, duties on agencies, procurement, or public institutions.",
    select: (claims) => claims.filter((claim) => typeof claim.fields.actor_type === "string"),
    executive: ({ selected, notes }) => {
      const provider = has(selected, "actor_type", "market_provider");
      const agency = has(selected, "actor_type", "federal_agency");
      const vendor = has(selected, "actor_type", "government_vendor");
      // Cited group by group rather than in one run, so a reader following a
      // citation lands on the records for that clause and not on all of them.
      return [
        {
          text: `The reviewed records distribute evaluation governance across ${count(groupBy(selected, "actor_type").length, "class", "classes")} of addressee rather than concentrating it on one.`,
          notes: [],
        },
        {
          text: sentence(
            `${count(provider.length, "provision")} ${agree(provider.length, "is", "are")} addressed to a provider placing a model on the market.`,
          ),
          notes: notes.citeAll(provider, "actor_type"),
        },
        {
          text: sentence(
            `${count(agency.length, "provision")} ${agree(agency.length, "is", "are")} addressed to a federal agency, and ${count(vendor.length, "provision")} to a vendor supplying AI to the government under contract.`,
          ),
          notes: [...notes.citeAll(agency, "actor_type"), ...notes.citeAll(vendor, "actor_type")],
        },
      ];
    },
    conclusion: ({ selected, notes }) => {
      const agency = has(selected, "actor_type", "federal_agency");
      const vendor = has(selected, "actor_type", "government_vendor");
      const provider = has(selected, "actor_type", "market_provider");
      const bindingProvider = provider.filter((claim) => claim.fields.legal_force === "binding");
      return [
        {
          text: `Where the reviewed corpus governs evaluation through public institutions, it does so by binding the agency that uses or buys the system and, through procurement, the vendor that supplies it${vendor.length ? "" : ""}.`,
          notes: [
            ...notes.citeAll(agency, "binding_scope"),
            ...notes.citeAll(vendor, "actor_type"),
          ],
        },
        {
          text: `Where it regulates the provider directly, it does so as a duty on the party that places the model on the market${bindingProvider.length ? "" : ""}.`,
          notes: notes.citeAll(bindingProvider.slice(0, 6), "actor_type"),
        },
        {
          text: "These are different instruments reaching different parties, and a duty on a public buyer does not extend to the market at large.",
          notes: [],
        },
      ];
    },
  },
];

export function demoQuestions(): readonly QuestionConfig[] {
  return QUESTIONS;
}

export function demoQuestion(id: string): QuestionConfig | undefined {
  return QUESTIONS.find((question) => question.id === id);
}

/* ------------------------------------------------------------ the sections */

function actorsSection(context: BuildContext): MemoSection {
  const { selected, notes } = context;
  const groups = groupBy(selected, "actor_type");
  const paragraphs: MemoSentence[][] = [
    groups.map((group) => {
      // Where the reviewers wrote the addressee out in their own words, use
      // theirs rather than restating the coded class.
      const local = [
        ...new Set(
          group.claims
            .map((claim) => claim.fields.actor_term_local?.trim())
            .filter((term): term is string => Boolean(term)),
        ),
      ];
      const gloss = local.length === 1 ? `, described in the source as “${local[0]}”` : "";
      return {
        text: sentence(
          `${count(group.claims.length, "provision")} ${agree(group.claims.length, "is", "are")} addressed to ${actorPhrase(group.value)}${gloss}.`,
        ),
        notes: notes.citeAll(group.claims, "actor_type"),
      };
    }),
  ];

  const scoped = selected.filter((claim) => typeof claim.fields.binding_scope === "string");
  if (scoped.length > 0) {
    paragraphs.push(
      groupBy(scoped, "binding_scope").map((group) => ({
        text: sentence(
          `${count(group.claims.length, "provision")} ${agree(group.claims.length, "binds", "bind")} only within ${scopeBoundary(group.value)}, and ${agree(group.claims.length, "reaches", "reach")} no one outside it.`,
        ),
        notes: notes.citeAll(group.claims, "binding_scope"),
      })),
    );
  }
  return {
    id: "actors",
    heading: "Responsible actors",
    purpose: "Who each rule is addressed to.",
    paragraphs,
  };
}

function conductSection(context: BuildContext): MemoSection {
  const { selected, notes } = context;
  const groups = groupBy(selected, "conduct_type");
  const paragraphs: MemoSentence[][] = [
    groups.map((group) => {
      const local = [
        ...new Set(
          group.claims
            .map((claim) => claim.fields.conduct_term_local?.trim())
            .filter((term): term is string => Boolean(term)),
        ),
      ];
      const gloss = local.length === 1 ? `, stated in the source as “${local[0]}”` : "";
      return {
        text: sentence(
          `${count(group.claims.length, "provision")} ${agree(group.claims.length, "requires", "require")} the actor to ${conductPhrase(group.value)}${gloss}.`,
        ),
        notes: notes.citeAll(group.claims, "conduct_type"),
      };
    }),
  ];

  const evaluation = has(selected, "conduct_type", "model_evaluation");
  const adjacent = selected.filter((claim) =>
    ADJACENT_TO_EVALUATION.includes(claim.fields.conduct_type as never),
  );
  if (evaluation.length > 0 && adjacent.length > 0) {
    paragraphs.push([
      {
        text: `The reviewed records keep model evaluation apart from the duties that surround it. ${sentence(count(adjacent.length, "selected provision"))} ${agree(adjacent.length, "concerns", "concern")} documenting an evaluation, assessing risk, monitoring, reporting incidents, granting access for evaluation or testing during procurement, and none of them requires the actor to evaluate the model.`,
        notes: notes.citeAll(adjacent, "conduct_type"),
      },
    ]);
  }
  return {
    id: "conduct",
    heading: "Required conduct",
    purpose: "What each rule asks the actor to do.",
    paragraphs,
  };
}

function forceSection(context: BuildContext): MemoSection {
  const { selected, notes } = context;
  const paragraphs: MemoSentence[][] = [
    groupBy(selected, "legal_force").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${agree(group.claims.length, "is", "are")} ${forcePhrase(group.value)}.`,
      ),
      notes: notes.citeAll(group.claims, "legal_force"),
    })),
  ];

  const functions = groupBy(selected, "compliance_function");
  if (functions.length > 0) {
    paragraphs.push([
      {
        text: "Legal force and compliance function are recorded separately, because a measure's strength and the use made of it are different questions.",
        notes: [],
      },
      ...functions.map((group) => ({
        text: sentence(
          `${count(group.claims.length, "provision")} ${functionPhrase(group.value, group.claims.length) ?? humanize(group.value)}.`,
        ),
        notes: notes.citeAll(group.claims, "compliance_function"),
      })),
    ]);
  }
  return {
    id: "force",
    heading: "Legal force",
    purpose: "How strongly each measure binds, and what it is used to show.",
    paragraphs,
  };
}

function applicabilitySection(context: BuildContext): MemoSection {
  const { selected, notes } = context;
  const paragraphs: MemoSentence[][] = [
    groupBy(selected, "adoption_status").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${adoptionPhrase(group.value, group.claims.length)}.`,
      ),
      notes: notes.citeAll(group.claims, "adoption_status"),
    })),
    groupBy(selected, "applicability_status").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${applicabilityPhrase(group.value, group.claims.length)}.`,
      ),
      notes: notes.citeAll(group.claims, "applicability_status"),
    })),
  ];

  const enforcement = groupBy(selected, "enforcement_status");
  const unknown = has(selected, "enforcement_status", "unknown");
  paragraphs.push(
    enforcement.map((group) => ({
      text: `For ${count(group.claims.length, "provision")}, ${enforcementPhrase(group.value)}.`,
      notes: notes.citeAll(group.claims, "enforcement_status"),
    })),
  );
  if (unknown.length > 0) {
    paragraphs.push([
      {
        text: "An unknown enforcement status is a gap in the reviewed record, not a finding that the measure is unenforceable. It is left as it was recorded.",
        notes: [],
      },
    ]);
  }
  return {
    id: "applicability",
    heading: "Current applicability",
    purpose: "Whether each measure has been adopted, whether it applies, and how it is enforced.",
    paragraphs,
  };
}

/* -------------------------------------------------------------- the builder */

export function buildMemo(questionId: string): Memo | undefined {
  const config = demoQuestion(questionId);
  if (!config) return undefined;

  const corpus = policyTestClaimRecords();
  // Stable order: the reviewers' row order, which the pilot treats as authority.
  const selected = config.select(corpus);
  const notes = new Footnotes();
  const context: BuildContext = { selected, corpus, notes };

  // Executive finding first, so its citations take the low numbers a reader
  // meets first; sections and conclusion follow in reading order.
  const executive = config.executive(context);
  const sections = [
    actorsSection(context),
    conductSection(context),
    forceSection(context),
    applicabilitySection(context),
  ];
  const conclusion = config.conclusion(context);

  const untraced = selected
    .filter((claim) => !sourceFor(claim.claimId) && !sourceFor(claim.parentRowId))
    .map((claim) => claim.claimId);

  return {
    questionId: config.id,
    question: config.question,
    title: config.title,
    kind: config.kind,
    datasetId: policyTestDataset().dataset_id,
    profileId: PROFILE_ID,
    executive,
    sections,
    conclusion,
    footnotes: notes.list,
    coverage: {
      selected: selected.length,
      corpus: corpus.length,
      untraced,
      documents: new Set(
        notes.list.map((note) => note.document?.title).filter((title): title is string => !!title),
      ).size,
    },
  };
}
