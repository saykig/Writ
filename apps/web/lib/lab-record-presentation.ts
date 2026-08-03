/**
 * Everything a person wrote for the Lab, in one file.
 *
 * Two kinds of thing live here and nothing else does:
 *
 *   1. Field labels and their order. Presentation only — the coded key and the
 *      value are the record's, and no field is renamed into a different claim.
 *   2. Seven curated records, each with a plain-language reading, the reading it
 *      must not be stretched into, and a list of anchors tying one coded field
 *      to one verbatim phrase in the retrieved passage.
 *
 * The anchors are deliberately partial. A record is classified from a provision;
 * the retrieved passage is one span of that provision. Article 55(1)(a) does not
 * contain the word "provider" — the addressee is in the chapeau above it — and
 * the NIST profile abstract does not contain the word "evaluation". Those fields
 * are grounded outside the quoted span, and the interface says so rather than
 * highlighting something close enough.
 *
 * Every phrase below is copied out of `provenance/passages.json`. The adapter
 * throws if one of them is not found, so a retyped quotation fails in CI rather
 * than silently going dark on the page.
 *
 * Free of Node imports so client components can read the order and the labels.
 */

import type { GuidedGroup, RecordFieldKey } from "./record-view.js";

/** A verbatim substring of the passage quote that grounds one coded field. */
export interface LabRecordAnchor {
  field: RecordFieldKey;
  phrase: string;
}

export interface LabRecordPresentation {
  /** Claim id, checked against the reviewed dataset when the view is built. */
  id: string;
  /** What this record says, in ordinary words. Editorial. */
  reading: string;
  /** The reading it must not be stretched into. Editorial. */
  limit: string;
  /** A short chip for the selector and the header. Editorial. */
  badge: string;
  /** Why this record is in the Lab at all. Editorial. */
  why: string;
  anchors: readonly LabRecordAnchor[];
}

/**
 * Seven records, chosen because the distinctions between them are the ones a
 * reader most often collapses: a duty to evaluate against a duty to document an
 * evaluation, an exception against an absence, a voluntary route into a binding
 * regime against the regime itself, a government-use duty against a market-wide
 * one, and a proposal against a rule.
 */
export const LAB_RECORDS: readonly LabRecordPresentation[] = [
  {
    id: "EU-06",
    badge: "Binding · in force",
    reading:
      "A provider of a general-purpose AI model with systemic risk must carry out model evaluation itself, using standardised protocols and including adversarial testing.",
    limit:
      "It reaches providers of models with systemic risk. It is not a duty on every provider, and not on the organisations that deploy or use a model.",
    why: "This is the one record in the pilot that satisfies all four conditions of the headline rule: a market provider, model evaluation, binding, and already applicable.",
    anchors: [
      { field: "conduct_type", phrase: "perform model evaluation" },
      {
        field: "conduct_term_local",
        phrase:
          "in accordance with standardised protocols and tools reflecting the state of the art",
      },
    ],
  },
  {
    id: "EU-01",
    badge: "Binding · documentation",
    reading:
      "A provider must draw up and keep technical documentation that includes the results of the model's evaluation, and hand it over on request.",
    limit:
      "Requiring that evaluation results appear in documentation is not requiring that an evaluation be performed. The duty here is to document, and the two are recorded as different conduct.",
    why: "Placed beside Article 55(1)(a) because the difference between evaluating and documenting an evaluation is the distinction this pilot most often has to defend.",
    anchors: [
      { field: "conduct_type", phrase: "draw up and keep up-to-date the technical documentation" },
      { field: "conduct_term_local", phrase: "the results of its evaluation" },
      { field: "implementation_body", phrase: "the AI Office" },
      { field: "additional_authority", phrase: "the national competent authorities" },
    ],
  },
  {
    id: "EU-05",
    badge: "Binding · exception",
    reading:
      "Two of the Article 53 documentation obligations do not apply to providers releasing a model under a free and open-source licence that makes its parameters public.",
    limit:
      "It lifts named obligations under conditions, and it stops at models with systemic risk. It is not a general exemption from the AI Act, and the reviewers recorded that its statutory conditions are not fully encoded here.",
    why: "An exception is a record in its own right. Reading it as an absence of obligation, or as a blanket carve-out, are two different errors.",
    anchors: [
      {
        field: "exception_target",
        phrase: "The obligations set out in paragraph 1, points (a) and (b)",
      },
      { field: "compliance_function", phrase: "shall not apply" },
      { field: "defined_actor_class", phrase: "released under a free and open-source licence" },
      { field: "exception_conditions_status", phrase: "are made publicly available" },
    ],
  },
  {
    id: "EU-12",
    badge: "Voluntary · compliance path",
    reading:
      "A provider may sign the General-Purpose AI Code of Practice and use adherence to it as a way of demonstrating compliance with binding AI Act duties.",
    limit:
      "The Code is voluntary. That it demonstrates compliance with a binding regime does not make the Code itself binding, and no source document is registered for this record, so the classification has not been checked against retrieved text.",
    why: "Two things a reader can get wrong at once: a voluntary instrument next to a binding regime, and a record whose source has not been traced.",
    anchors: [],
  },
  {
    id: "US-03",
    badge: "Voluntary · guidance",
    reading:
      "The NIST Generative AI Profile helps organisations that design, develop, use or evaluate generative AI bring trustworthiness considerations into that work.",
    limit:
      "It concerns evaluation, but nobody is required to follow it. Voluntary guidance about evaluation is not a binding evaluation duty, and treating the two as the same is what flips the United States answer to yes.",
    why: "The clearest United States record about model evaluation, and the clearest illustration that subject matter and legal force are separate questions.",
    anchors: [
      {
        field: "actor_type",
        phrase: "assist organizations in deciding how to best manage AI risks",
      },
      { field: "target_system", phrase: "Generative AI (GAI)" },
      {
        field: "source_lifecycle_activities",
        phrase: "across various stages of the AI lifecycle",
      },
    ],
  },
  {
    id: "US-08A",
    badge: "Binding · government use",
    reading:
      "Federal agencies must carry out pre-deployment testing of high-impact AI before they use it, and prepare mitigation plans alongside it.",
    limit:
      "This binds agencies as users of AI, not the market. It creates no duty on a provider placing a model on the market, and its passage was recorded against the parent bundle rather than this record.",
    why: "A binding testing duty that reaches only the government. Generalising it into a market-wide provider obligation is the most consequential error the pilot guards against.",
    anchors: [
      { field: "conduct_term_local", phrase: "Conduct Pre-Deployment Testing" },
      { field: "actor_type", phrase: "Agencies" },
      { field: "legal_force", phrase: "must" },
      { field: "conduct_type", phrase: "develop pre-deployment testing" },
    ],
  },
  {
    id: "US-11",
    badge: "Proposed · not yet applicable",
    reading:
      "An executive order directs the FTC and FCC to consider adopting a federal reporting and disclosure standard for AI models.",
    limit:
      "Considering a standard is not adopting one. Nothing here applies to an AI company yet, and the record is kept as proposed rather than folded in with rules that are in force.",
    why: "A proposal recorded as a proposal. Counting it as current regulation would overstate what United States law requires today.",
    anchors: [
      {
        field: "current_actor_term_local",
        phrase: "the Federal Trade Commission and Federal Communications Commission",
      },
      { field: "prospective_actor_term_local", phrase: "AI companies" },
      {
        field: "proposal_action",
        phrase:
          "considering whether to adopt a Federal reporting and disclosure standard for AI models",
      },
    ],
  },
];

export interface GuidedFieldSpec {
  key: RecordFieldKey;
  /** Plain-language label. Presentation only; the coded key is unchanged. */
  label: string;
  group: GuidedGroup;
}

/**
 * Every field the reviewed schema carries, in reading order.
 *
 * Exhaustive on purpose. A whitelist that happened to omit `exception_target`,
 * `underlying_regime_force` or `proposal_action` would hide exactly the fields
 * these seven records exist to show, and a hidden field reads as one the
 * reviewers never filled in.
 */
export const GUIDED_FIELD_ORDER: readonly GuidedFieldSpec[] = [
  { key: "record_type", label: "Record type", group: "identity" },
  { key: "instrument", label: "Instrument", group: "identity" },

  { key: "actor_type", label: "Actor", group: "actor" },
  { key: "actor_term_local", label: "Actor, in the source’s words", group: "actor" },
  { key: "defined_actor_class", label: "Defined actor class", group: "actor" },
  { key: "actor_relationship", label: "Actor relationship", group: "actor" },
  { key: "target_actor", label: "Target actor", group: "actor" },
  { key: "recipient_actor_type", label: "Recipient", group: "actor" },
  { key: "recipient_actor_term_local", label: "Recipient, in the source’s words", group: "actor" },
  { key: "current_actor_type", label: "Actor acting now", group: "actor" },
  { key: "current_actor_term_local", label: "Acting now, in the source’s words", group: "actor" },
  { key: "prospective_actor_type", label: "Actor if adopted", group: "actor" },
  {
    key: "prospective_actor_term_local",
    label: "If adopted, in the source’s words",
    group: "actor",
  },
  { key: "indirectly_affected_actor_type", label: "Indirectly affected", group: "actor" },
  { key: "additional_affected_actor_type", label: "Also affected", group: "actor" },
  {
    key: "additional_actor_term_local",
    label: "Also affected, in the source’s words",
    group: "actor",
  },
  { key: "excluded_direct_actor_types", label: "Actors explicitly excluded", group: "actor" },

  { key: "conduct_type", label: "Claim or conduct", group: "conduct" },
  { key: "conduct_term_local", label: "Conduct, in the source’s words", group: "conduct" },
  { key: "conduct_family", label: "Conduct family", group: "conduct" },
  { key: "proposal_action", label: "Proposed action", group: "conduct" },
  { key: "evaluation_method", label: "Evaluation method", group: "conduct" },
  { key: "required_vendor_conduct", label: "Required of the vendor", group: "conduct" },
  { key: "target_system", label: "Object", group: "conduct" },
  { key: "scope", label: "Scope", group: "conduct" },
  { key: "covered_scope", label: "Covered scope", group: "conduct" },

  { key: "exception_target", label: "Obligations excepted", group: "conditions" },
  { key: "exception_scope_local", label: "Exception, in the source’s words", group: "conditions" },
  { key: "exception_conditions_status", label: "Conditions", group: "conditions" },
  { key: "classification_indicators", label: "Classification indicators", group: "conditions" },
  { key: "noncompliance_consequence", label: "Consequence of non-compliance", group: "conditions" },

  { key: "legal_force", label: "Legal force", group: "force" },
  { key: "source_legal_force_label", label: "Force, as the source labels it", group: "force" },
  { key: "compliance_function", label: "Compliance function", group: "force" },
  { key: "binding_scope", label: "Binding scope", group: "force" },
  { key: "underlying_regime_force", label: "Force of the underlying regime", group: "force" },
  { key: "underlying_instrument", label: "Underlying instrument", group: "force" },
  { key: "source_instrument_force", label: "Force of the instrument", group: "force" },
  { key: "described_obligation_force", label: "Force of the obligation described", group: "force" },

  { key: "adoption_status", label: "Adoption", group: "lifecycle" },
  { key: "applicability_status", label: "Applicability", group: "lifecycle" },
  { key: "enforcement_status", label: "Enforcement", group: "lifecycle" },
  { key: "effective_from", label: "Effective from", group: "lifecycle" },
  { key: "compliance_deadline", label: "Compliance deadline", group: "lifecycle" },

  { key: "responsible_authority", label: "Authority", group: "authority" },
  { key: "responsible_authorities", label: "Authorities", group: "authority" },
  { key: "potential_responsible_authorities", label: "Possible authorities", group: "authority" },
  { key: "additional_authority", label: "Additional authority", group: "authority" },
  { key: "implementation_body", label: "Implementation body", group: "authority" },
  { key: "policy_authority", label: "Policy authority", group: "authority" },
  { key: "policy_origin", label: "Policy origin", group: "authority" },

  { key: "headline_relevance", label: "Relevance to the pilot question", group: "other" },
  { key: "source_actions", label: "Actions named in the source", group: "other" },
  {
    key: "source_lifecycle_activities",
    label: "Lifecycle activities named in the source",
    group: "other",
  },
  { key: "source_topics", label: "Topics named in the source", group: "other" },
  { key: "framework_functions", label: "Framework functions", group: "other" },
];

/** Keys that identify or contain a record rather than describing it. */
export const STRUCTURAL_KEYS: ReadonlySet<string> = new Set([
  "row_id",
  "claim_id",
  "review_decision",
  "jurisdiction",
  "source_locator",
  "interpretation_note",
  "derived_claims",
]);
