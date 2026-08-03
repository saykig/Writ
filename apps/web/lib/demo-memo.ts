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
  demoAnalysisClaimRecords,
  demoAnalysisDataset,
  type ClaimFields,
  type ClaimRecord,
} from "./demo-analysis.js";
import { sourceFor } from "./pilot-sources.js";
import { humanize, instrumentLabel } from "./demo-analysis-format.js";
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

export interface MemoRecord {
  /** Set only where the memo cites this record inline. */
  n?: number;
  claimId: string;
  /** The reviewed fields this record was cited for, if it was cited at all. */
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
  /**
   * Every record the memo drew on, in reviewed order. Inline citations are kept
   * for the sentences that genuinely rest on a named provision; this list is
   * what makes the aggregate statements checkable without littering the prose.
   */
  records: MemoRecord[];
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
 * Holds every selected record, and numbers the few that are cited inline.
 *
 * Citations are spent sparingly: on a sentence that quotes a provision's own
 * wording, on the records a finding actually turns on, and on the distinctions
 * the pilot exists to protect. A sentence that merely counts how the corpus
 * divides carries no marker, because the record list below the memo already
 * answers "which ones" without interrupting the reading.
 */
class Ledger {
  private readonly index = new Map<string, MemoRecord>();
  readonly list: MemoRecord[] = [];
  private numbered = 0;

  /** Register a record so it appears in the list, cited or not. */
  register(claim: ClaimRecord): MemoRecord {
    const existing = this.index.get(claim.claimId);
    if (existing) return existing;

    const sourced = sourceFor(claim.claimId) ?? sourceFor(claim.parentRowId);
    const record: MemoRecord = {
      claimId: claim.claimId,
      supportingFields: [],
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
    };
    this.index.set(claim.claimId, record);
    this.list.push(record);
    return record;
  }

  /** Cite a record inline, assigning its number the first time. */
  cite(claim: ClaimRecord, supportingField: string): number {
    const record = this.register(claim);
    if (!record.supportingFields.includes(supportingField)) {
      record.supportingFields.push(supportingField);
    }
    if (record.n === undefined) {
      this.numbered += 1;
      record.n = this.numbered;
    }
    return record.n;
  }

  /** Ascending and deduplicated, so a citation run reads in order. */
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
  notes: Ledger;
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

/** The jurisdictions, so a comparison question can be split without a filter. */
const inJurisdiction = (claims: readonly ClaimRecord[], jurisdiction: "EU" | "US") =>
  claims.filter((claim) => claim.jurisdiction === jurisdiction);

/**
 * Cite a group only when every member of it fits in one run.
 *
 * A citation on a subset of the records a sentence counts would send a reader to
 * some of the evidence while the sentence claims all of it. Over the limit, the
 * record list below the memo answers "which ones" instead.
 */
function citeGroup(notes: Ledger, claims: readonly ClaimRecord[], field: string): number[] {
  return claims.length > 0 && claims.length <= 6 ? notes.citeAll(claims, field) : [];
}

const QUESTIONS: QuestionConfig[] = [
  {
    id: "binding-duties-eu-us",
    question:
      "How do binding model-evaluation duties differ between the European Union and the United States?",
    title: "Binding model-evaluation duties in the European Union and the United States",
    kind: "Comparison",
    description:
      "Which binding duties reach a provider placing a model on the market, and which reach only government.",
    select: (claims) =>
      claims.filter(
        (claim) =>
          claim.fields.legal_force === "binding" ||
          EVALUATION_CONDUCT.includes(claim.fields.conduct_type as never),
      ),
    executive: ({ selected, notes }) => {
      const providerDuty = selected.filter(
        (claim) =>
          claim.fields.legal_force === "binding" &&
          claim.fields.actor_type === "market_provider" &&
          claim.fields.conduct_type === "model_evaluation" &&
          claim.fields.applicability_status === "applicable",
      );
      const scoped = selected.filter((claim) => typeof claim.fields.binding_scope === "string");
      const euProvider = inJurisdiction(providerDuty, "EU");
      const usProvider = inJurisdiction(providerDuty, "US");
      const sentences: MemoSentence[] = [
        {
          text: sentence(
            `${count(euProvider.length, "European Union provision")} ${agree(euProvider.length, "binds", "bind")} a provider placing a model on the market to perform model evaluation, and ${count(usProvider.length, "United States provision does", "United States provisions do")} so.`,
          ),
          notes: citeGroup(notes, providerDuty, "headline_relevance"),
        },
      ];
      if (scoped.length > 0) {
        const boundaries = [
          ...new Set(scoped.map((claim) => scopeBoundary(claim.fields.binding_scope as string))),
        ];
        sentences.push({
          text: sentence(
            `${count(scoped.length, "United States provision records", "United States provisions record")} an explicit boundary on what ${agree(scoped.length, "it binds", "they bind")}: ${joinList(boundaries)}.`,
          ),
          notes: [],
        });
      }
      return sentences;
    },
    conclusion: ({ selected }) => {
      const euBinding = inJurisdiction(selected, "EU").filter(
        (claim) => claim.fields.legal_force === "binding",
      );
      const usBinding = inJurisdiction(selected, "US").filter(
        (claim) => claim.fields.legal_force === "binding",
      );
      const scoped = usBinding.filter((claim) => typeof claim.fields.binding_scope === "string");
      return [
        {
          text: `Both jurisdictions carry binding duties in this corpus: ${count(euBinding.length, "in the European Union", "in the European Union")} and ${count(usBinding.length, "in the United States", "in the United States")}. The difference is not how many, but whom they reach.`,
          notes: [],
        },
        {
          text: `The European Union addresses a provider placing a model on the market. ${sentence(count(scoped.length, "of the binding United States provision", "of the binding United States provisions"))} ${agree(scoped.length, "names", "name")} the part of government ${agree(scoped.length, "it binds", "they bind")}, and the reviewers recorded that boundary as part of the rule rather than as a description of current practice.`,
          // A count, so no marker: the evidence list below names which ones.
          notes: [],
        },
        {
          text: "A duty on a public body that uses or buys a system is not a duty on the company that supplies it. Reading the two as one is what turns an absence of market regulation into an apparent presence of it.",
          notes: [],
        },
      ];
    },
  },
  {
    id: "us-voluntary-or-government",
    question:
      "Which United States model-evaluation requirements are voluntary or limited to government use?",
    title: "Voluntary and government-scoped evaluation requirements in the United States",
    kind: "Scope and force",
    description:
      "Where United States evaluation requirements sit: voluntary guidance, government use, procurement, or proposals.",
    select: (claims) => claims.filter((claim) => claim.jurisdiction === "US"),
    executive: ({ selected, notes }) => {
      const voluntary = has(selected, "legal_force", "voluntary");
      const scoped = selected.filter((claim) => typeof claim.fields.binding_scope === "string");
      const contractual = has(selected, "legal_force", "contractual");
      return [
        {
          text: sentence(
            `${count(voluntary.length, "United States provision is", "United States provisions are")} voluntary, and ${count(scoped.length, "carries", "carry")} an explicit boundary on what ${agree(scoped.length, "it binds", "they bind")}.`,
          ),
          notes: [],
        },
        {
          text: contractual.length
            ? sentence(
                `A further ${count(contractual.length, "provision reaches", "provisions reach")} a supplier through the terms of a procurement contract rather than through market regulation.`,
              )
            : "No provision in this corpus reaches a supplier through a procurement contract.",
          notes: citeGroup(notes, contractual, "compliance_function"),
        },
      ];
    },
    conclusion: ({ selected }) => {
      const groups = groupBy(selected, "legal_force");
      const proposed = has(selected, "legal_force", "proposed");
      return [
        {
          text: sentence(
            `Across the reviewed United States records, evaluation requirements divide by legal force into ${count(groups.length, "kind", "kinds")}: ${joinList(groups.map((group) => `${count(group.claims.length, "that is", "that are")} ${group.value}`))}.`,
          ),
          notes: [],
        },
        {
          text: "None of them requires a provider placing a model on the market to perform model evaluation. Voluntary guidance addresses anyone willing to follow it; a government-use duty addresses the agency; a contractual duty addresses whoever signed.",
          notes: [],
        },
        proposed.length
          ? {
              text: sentence(
                `${count(proposed.length, "further provision remains", "further provisions remain")} proposed, and ${agree(proposed.length, "is", "are")} recorded as not yet applicable rather than counted with the rest.`,
              ),
              notes: [],
            }
          : {
              text: "Nothing in the reviewed United States records is recorded as proposed but not adopted.",
              notes: [],
            },
      ];
    },
  },
  {
    id: "documentation-versus-evaluation",
    question:
      "When does documentation about evaluation differ from an obligation to conduct evaluation?",
    title: "Documenting an evaluation and performing one",
    kind: "Conduct distinction",
    description:
      "Where a rule requires evaluation results to be written down, and where it requires the evaluation itself.",
    select: (claims) =>
      claims.filter(
        (claim) =>
          claim.fields.conduct_type === "model_evaluation" ||
          ADJACENT_TO_EVALUATION.includes(claim.fields.conduct_type as never),
      ),
    executive: ({ selected, notes }) => {
      const performing = has(selected, "conduct_type", "model_evaluation");
      const documenting = has(selected, "conduct_type", "evaluation_documentation");
      return [
        {
          text: sentence(
            `${count(performing.length, "selected provision requires", "selected provisions require")} the actor to perform model evaluation itself.`,
          ),
          notes: citeGroup(notes, performing, "conduct_type"),
        },
        {
          text: sentence(
            `${count(documenting.length, "requires", "require")} documentation that contains evaluation results, which the reviewers recorded as different conduct rather than as a weaker form of the same duty.`,
          ),
          notes: citeGroup(notes, documenting, "conduct_type"),
        },
      ];
    },
    conclusion: ({ selected }) => {
      const adjacent = selected.filter((claim) =>
        ADJACENT_TO_EVALUATION.includes(claim.fields.conduct_type as never),
      );
      return [
        {
          text: "A duty to document evaluation results assumes an evaluation happened; it does not create the duty to carry one out. Where the two coincide it is because a separate provision imposes the evaluation, not because the documentation rule reaches that far.",
          notes: [],
        },
        {
          text: sentence(
            `${count(adjacent.length, "selected provision sits", "selected provisions sit")} next to model evaluation without being it: documenting, assessing risk, monitoring, reporting an incident, granting access for evaluation, or testing during procurement.`,
          ),
          notes: [],
        },
        {
          text: "Collapsing them would widen the European Union answer from one provision to nine, and would do it without any record having changed.",
          notes: [],
        },
      ];
    },
  },
  {
    id: "code-of-practice",
    question: "What role does the European Union Code of Practice play in compliance?",
    title: "The General-Purpose AI Code of Practice as a compliance route",
    kind: "Soft law and binding law",
    description:
      "Whether the Code creates duties of its own, or is a recognised way of showing that duties elsewhere have been met.",
    select: (claims) =>
      claims.filter(
        (claim) =>
          claim.jurisdiction === "EU" &&
          (claim.fields.compliance_function === "recognized_compliance_path" ||
            claim.fields.legal_force === "voluntary" ||
            claim.fields.compliance_function === "direct_obligation"),
      ),
    executive: ({ selected, notes }) => {
      const paths = has(selected, "compliance_function", "recognized_compliance_path");
      const underlying = [
        ...new Set(
          paths
            .map((claim) => claim.fields.underlying_regime_force)
            .filter((force): force is string => Boolean(force)),
        ),
      ];
      return [
        {
          text: sentence(
            `${count(paths.length, "European Union record is", "European Union records are")} recorded as a recognised way of demonstrating compliance rather than as ${agree(paths.length, "a duty of its own", "duties of their own")}.`,
          ),
          notes: citeGroup(notes, paths, "compliance_function"),
        },
        {
          text: underlying.length
            ? sentence(
                `${agree(paths.length, "It stands", "They stand")} beside a regime the reviewers recorded as ${joinList(underlying.map(forcePhrase))}, and ${agree(paths.length, "its", "their")} own legal force is recorded separately.`,
              )
            : "Its own legal force is recorded separately from the regime it sits beside.",
          notes: [],
        },
      ];
    },
    conclusion: ({ selected, notes }) => {
      const paths = has(selected, "compliance_function", "recognized_compliance_path");
      const voluntaryPaths = paths.filter((claim) => claim.fields.legal_force === "voluntary");
      const direct = has(selected, "compliance_function", "direct_obligation");
      return [
        {
          text: "Signing the Code is a route, not a rule. Following it is a way of showing that an obligation recorded elsewhere has been met, and the obligation remains where it was.",
          notes: citeGroup(notes, voluntaryPaths, "legal_force"),
        },
        {
          text: sentence(
            `${count(direct.length, "European Union record in this selection imposes", "European Union records in this selection impose")} a duty directly. The Code is not among them, and its voluntary force is unchanged by the fact that the duties it demonstrates compliance with are binding.`,
          ),
          notes: [],
        },
        {
          text: "The reviewers also recorded that no source document is registered for the signatory notice, so this classification has not been checked against retrieved text.",
          notes: [],
        },
      ];
    },
  },
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
          notes: [],
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
    executive: ({ selected }) => {
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
          notes: [],
        },
        {
          text: sentence(
            `${count(agency.length, "provision")} ${agree(agency.length, "is", "are")} addressed to a federal agency, and ${count(vendor.length, "provision")} to a vendor supplying AI to the government under contract.`,
          ),
          notes: [],
        },
      ];
    },
    conclusion: ({ selected }) => {
      const agency = has(selected, "actor_type", "federal_agency");
      const vendor = has(selected, "actor_type", "government_vendor");
      const provider = has(selected, "actor_type", "market_provider");
      return [
        {
          text: `Where the reviewed corpus governs evaluation through public institutions, it does so by binding the agency that uses or buys the system, and by carrying duties to the vendor through the procurement contract rather than through market regulation.`,
          notes: [],
        },
        {
          text: `${count(agency.length + vendor.length, "provision reaches", "provisions reach")} its addressee that way, against ${count(provider.length, "addressed")} to a provider placing a model on the market.`,
          notes: [],
        },
        {
          text: "These are different instruments reaching different parties. A duty on a public buyer, or on the vendor that sells to it, does not extend to the market at large.",
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
  const { selected } = context;
  // A distribution, not an assertion about any one provision: no quoted wording
  // and no citations. The reviewers' own term for each addressee is on the
  // record itself, one click away from the list below the memo.
  const paragraphs: MemoSentence[][] = [
    groupBy(selected, "actor_type").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${agree(group.claims.length, "is", "are")} addressed to ${actorPhrase(group.value)}.`,
      ),
      notes: [],
    })),
  ];

  const scoped = selected.filter((claim) => typeof claim.fields.binding_scope === "string");
  if (scoped.length > 0) {
    paragraphs.push(
      groupBy(scoped, "binding_scope").map((group) => ({
        text: sentence(
          `${count(group.claims.length, "provision")} ${agree(group.claims.length, "binds", "bind")} only within ${scopeBoundary(group.value)}, and ${agree(group.claims.length, "reaches", "reach")} no one outside it.`,
        ),
        notes: [],
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

  // The distribution first, as a plain enumeration. Quoting each provision's
  // own wording here would turn the section into a list of citations; the
  // record list below the memo already names every one of them.
  const paragraphs: MemoSentence[][] = [
    groups.map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${agree(group.claims.length, "requires", "require")} the actor to ${conductPhrase(group.value)}.`,
      ),
      notes: [],
    })),
  ];

  // Model evaluation is quoted and cited, because it is the conduct the pilot
  // turns on and the one most easily confused with its neighbours.
  const evaluation = has(selected, "conduct_type", "model_evaluation");
  if (evaluation.length > 0) {
    const terms = [
      ...new Set(
        evaluation
          .map((claim) => claim.fields.conduct_term_local?.trim())
          .filter((term): term is string => Boolean(term)),
      ),
    ];
    paragraphs.push([
      {
        text: `Where a provision requires model evaluation, the reviewed records state the duty in the source's own words${terms.length ? `: ${joinList(terms.map((term) => `“${term}”`))}` : ""}.`,
        notes: notes.citeAll(evaluation, "conduct_type"),
      },
    ]);
  }

  const adjacent = selected.filter((claim) =>
    ADJACENT_TO_EVALUATION.includes(claim.fields.conduct_type as never),
  );
  if (evaluation.length > 0 && adjacent.length > 0) {
    paragraphs.push([
      {
        text: `The reviewed records keep model evaluation apart from the duties that surround it. ${sentence(count(adjacent.length, "selected provision"))} ${agree(adjacent.length, "concerns", "concern")} documenting an evaluation, assessing risk, monitoring, reporting incidents, granting access for evaluation or testing during procurement, and none of them requires the actor to evaluate the model.`,
        notes: [],
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
      notes: [],
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
        // Only the recognised compliance path is cited: it is the line that
        // keeps a voluntary measure from reading as a binding one.
        notes:
          group.value === "recognized_compliance_path"
            ? notes.citeAll(group.claims, "compliance_function")
            : [],
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
  const { selected } = context;
  const paragraphs: MemoSentence[][] = [
    groupBy(selected, "adoption_status").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${adoptionPhrase(group.value, group.claims.length)}.`,
      ),
      notes: [],
    })),
    groupBy(selected, "applicability_status").map((group) => ({
      text: sentence(
        `${count(group.claims.length, "provision")} ${applicabilityPhrase(group.value, group.claims.length)}.`,
      ),
      notes: [],
    })),
  ];

  const enforcement = groupBy(selected, "enforcement_status");
  const unknown = has(selected, "enforcement_status", "unknown");
  paragraphs.push(
    enforcement.map((group) => ({
      text: `For ${count(group.claims.length, "provision")}, ${enforcementPhrase(group.value)}.`,
      notes: [],
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

  const corpus = demoAnalysisClaimRecords();
  // Stable order: the reviewers' row order, which the pilot treats as authority.
  const selected = config.select(corpus);
  const notes = new Ledger();
  // Registered up front and in reviewed order, so the record list reads as the
  // corpus the memo drew on rather than as the order citations happened to fall.
  for (const claim of selected) notes.register(claim);
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
    datasetId: demoAnalysisDataset().dataset_id,
    profileId: PROFILE_ID,
    executive,
    sections,
    conclusion,
    records: notes.list,
    coverage: {
      selected: selected.length,
      corpus: corpus.length,
      untraced,
      documents: new Set(
        notes.list
          .map((record) => record.document?.title)
          .filter((title): title is string => !!title),
      ).size,
    },
  };
}
