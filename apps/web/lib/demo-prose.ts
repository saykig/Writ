/**
 * The vocabulary that turns a reviewed field into a readable phrase.
 *
 * This is the only place in the Demo where a coded value becomes prose, and it
 * is a lookup, not a judgment: each entry restates its term and nothing more.
 * Nothing here widens an actor class, merges two kinds of conduct, or converts
 * a legal force into a stronger one. A term with no entry falls back to the
 * shared `humanize` helper, so an unmapped value surfaces as itself rather than
 * silently reading as something else.
 *
 * Node-free, so the memo and its footnotes can render on the client.
 */

import { humanize } from "./policy-test-format.js";

/**
 * Lowercase the first letter only. Using `toLowerCase()` on a whole humanized
 * term would flatten the initialisms it just restored, turning "AI" into "ai".
 */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Capitalize the first letter, for a sentence that opens with a number word. */
export function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Pick a verb form to agree with a count. */
export function agree(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/**
 * Who a rule is addressed to. These stay narrow on purpose: the pilot exists
 * partly to keep a duty on a government buyer from reading as a duty on the
 * company that built the model.
 */
const ACTOR_PHRASES: Record<string, string> = {
  market_provider: "a provider placing a model on the market",
  federal_agency: "a federal agency",
  government_vendor: "a vendor supplying AI to the government under contract",
  ai_lifecycle_organization: "an organisation designing, developing, deploying or using AI",
};

export function actorPhrase(term: string | null | undefined): string {
  if (!term) return "an actor the record does not classify";
  return ACTOR_PHRASES[term] ?? lowerFirst(humanize(term));
}

/**
 * What the rule asks for. Model evaluation is deliberately not grouped with
 * documenting an evaluation, assessing risk, monitoring, reporting an incident,
 * granting evaluation access, or testing during procurement. Those are separate
 * duties in the reviewed records and they stay separate here.
 */
const CONDUCT_PHRASES: Record<string, string> = {
  model_evaluation: "perform model evaluation",
  evaluation_documentation: "document evaluation results",
  evaluation_access: "provide access for evaluation",
  evaluation_participation: "take part in evaluations",
  evaluation_infrastructure_coordination: "coordinate evaluation standards and infrastructure",
  pre_deployment_testing: "test a system before deploying it",
  procurement_testing: "test a proposed system during procurement",
  risk_assessment: "assess risk",
  risk_management: "manage risk",
  monitoring_support: "support ongoing monitoring",
  incident_reporting: "report serious incidents",
  reporting_and_disclosure: "meet reporting and disclosure requirements",
  downstream_documentation: "supply documentation to downstream providers",
  contract_documentation: "supply documentation under contract",
  contract_terms_requirement: "include required terms in a contract",
  compliance_demonstration: "demonstrate compliance",
  copyright_policy: "maintain a copyright-compliance policy",
  training_content_summary: "publish a summary of training content",
  cybersecurity_protection: "protect the model with cybersecurity measures",
  regulatory_classification: "apply a regulatory classification",
  regulatory_notification: "notify the regulator",
  administrative_policy_revision: "review, revise or rescind agency policy",
};

export function conductPhrase(term: string | null | undefined): string {
  if (!term) return "conduct the record does not classify";
  return CONDUCT_PHRASES[term] ?? lowerFirst(humanize(term));
}

/** Conduct that sits near model evaluation without being it. */
export const ADJACENT_TO_EVALUATION = [
  "evaluation_documentation",
  "evaluation_access",
  "evaluation_participation",
  "risk_assessment",
  "monitoring_support",
  "incident_reporting",
  "pre_deployment_testing",
  "procurement_testing",
] as const;

/** How strongly the measure binds. Distinct from what it is used to show. */
const FORCE_PHRASES: Record<string, string> = {
  binding: "binding",
  voluntary: "voluntary",
  contractual: "contractual, arising from the terms of an agreement",
  interpretive: "interpretive, explaining how an existing rule is read",
  proposed: "proposed and not yet in force",
  mixed: "mixed, combining binding and non-binding elements",
};

export function forcePhrase(term: string | null | undefined): string {
  if (!term) return "of a legal force the record does not state";
  return FORCE_PHRASES[term] ?? lowerFirst(humanize(term));
}

/**
 * What the measure is used for in a compliance system, which is a different
 * question from whether it binds. A voluntary code can be a recognised way to
 * show compliance with a binding obligation without becoming binding itself.
 */
/** Both forms, so a sentence agrees with however many records it covers. */
interface Inflected {
  readonly s: string;
  readonly p: string;
}

const FUNCTION_PHRASES: Record<string, Inflected> = {
  direct_obligation: { s: "imposes the duty directly", p: "impose the duty directly" },
  recognized_compliance_path: {
    s: "is a recognised way of demonstrating compliance with a separate binding obligation",
    p: "are recognised ways of demonstrating compliance with a separate binding obligation",
  },
  evaluation_guidance: {
    s: "offers guidance on how to evaluate",
    p: "offer guidance on how to evaluate",
  },
  implementation_guidance: {
    s: "offers guidance on implementation",
    p: "offer guidance on implementation",
  },
  general_guidance: { s: "offers general guidance", p: "offer general guidance" },
  obligation_exception: {
    s: "carves out an exception to an obligation",
    p: "carve out exceptions to an obligation",
  },
  procurement_contract_obligation: {
    s: "imposes the duty through a procurement contract",
    p: "impose the duty through a procurement contract",
  },
  contract_condition_creation: {
    s: "creates the contractual condition under which a duty arises",
    p: "create the contractual conditions under which a duty arises",
  },
  evaluation_collaboration: {
    s: "establishes collaboration on evaluation",
    p: "establish collaboration on evaluation",
  },
  agency_policy_direction: { s: "directs agency policy", p: "direct agency policy" },
  policy_direction: { s: "sets policy direction", p: "set policy direction" },
  prospective_regulatory_requirement: {
    s: "describes a requirement that may be adopted in future",
    p: "describe requirements that may be adopted in future",
  },
};

export function functionPhrase(term: string | null | undefined, n = 1): string | undefined {
  if (!term) return undefined;
  const entry = FUNCTION_PHRASES[term];
  if (!entry) return lowerFirst(humanize(term));
  return n === 1 ? entry.s : entry.p;
}

/** Whether the measure is in force, and on what condition. */
const APPLICABILITY_PHRASES: Record<string, Inflected> = {
  applicable: { s: "currently applies", p: "currently apply" },
  not_yet_applicable: { s: "does not yet apply", p: "do not yet apply" },
  draft_available: {
    s: "exists only as a draft open for comment",
    p: "exist only as drafts open for comment",
  },
  contingent_on_contract: {
    s: "applies only where a contract brings it into effect",
    p: "apply only where a contract brings them into effect",
  },
  transition_for_existing_models: {
    s: "applies on a transitional timetable to models already on the market",
    p: "apply on a transitional timetable to models already on the market",
  },
};

export function applicabilityPhrase(term: string | null | undefined, n = 1): string {
  if (!term)
    return n === 1
      ? "has an applicability the record does not state"
      : "have an applicability the record does not state";
  const entry = APPLICABILITY_PHRASES[term];
  if (!entry) return lowerFirst(humanize(term));
  return n === 1 ? entry.s : entry.p;
}

const ADOPTION_PHRASES: Record<string, Inflected> = {
  adopted: { s: "has been adopted", p: "have been adopted" },
  proposed: { s: "has been proposed but not adopted", p: "have been proposed but not adopted" },
};

export function adoptionPhrase(term: string | null | undefined, n = 1): string {
  if (!term)
    return n === 1
      ? "has an adoption status the record does not state"
      : "have an adoption status the record does not state";
  const entry = ADOPTION_PHRASES[term];
  if (!entry) return lowerFirst(humanize(term));
  return n === 1 ? entry.s : entry.p;
}

/**
 * How the measure is enforced. `unknown` is returned as an explicit statement
 * that the reviewers did not determine it — never as "not enforceable", which
 * is a different finding the records do not make.
 */
const ENFORCEMENT_PHRASES: Record<string, string> = {
  unknown: "the reviewers did not determine how it is enforced",
  not_applicable: "enforcement does not arise, the measure being voluntary",
  not_determinable_from_passage: "enforcement could not be determined from the cited passage",
  internal_government_implementation: "it is implemented internally by government",
  internal_executive_implementation: "it is implemented internally by the executive branch",
  contractual_enforcement: "it is enforced through the contract",
};

export function enforcementPhrase(term: string | null | undefined): string {
  if (!term) return "the record does not state how it is enforced";
  return ENFORCEMENT_PHRASES[term] ?? lowerFirst(humanize(term));
}

/**
 * Which class of system or model the rule reaches, as a plural noun phrase so
 * it can be read into a sentence. Restating the class only: none of these
 * widens the class the reviewers recorded.
 */
const TARGET_PHRASES: Record<string, string> = {
  general_purpose_ai_model: "general-purpose AI models",
  general_purpose_ai_model_with_systemic_risk: "general-purpose AI models with systemic risk",
  general_purpose_ai_model_meeting_systemic_risk_threshold:
    "general-purpose AI models meeting the systemic-risk threshold",
  open_source_general_purpose_ai_model: "open-source general-purpose AI models",
  advanced_ai_model_system_or_agent: "advanced AI models, systems and agents",
  high_impact_ai_system: "high-impact AI systems",
  contracted_ai_system: "AI systems supplied under contract",
  agency_used_ai_system: "AI systems used by an agency",
  proposed_ai_solution: "AI solutions proposed during procurement",
  generative_ai_system: "generative AI systems",
  artificial_intelligence_system: "AI systems",
  artificial_intelligence_model: "AI models",
  artificial_intelligence_model_or_system: "AI models and systems",
};

export function targetPhrase(term: string | null | undefined): string | undefined {
  if (!term) return undefined;
  // Several targets were written out as prose by the reviewers rather than
  // coded; those are used as written.
  if (term.includes(" ")) return term;
  return TARGET_PHRASES[term] ?? lowerFirst(humanize(term));
}

/**
 * The reach of a rule that binds only inside one part of government. Phrased as
 * the boundary itself, so "binds only within the federal government" reads as a
 * limit rather than repeating the coded term.
 */
const SCOPE_BOUNDARY: Record<string, string> = {
  federal_agencies_only: "the federal government",
  government_contract_only: "the terms of a government contract",
  executive_branch_only: "the executive branch",
};

export function scopeBoundary(term: string): string {
  return SCOPE_BOUNDARY[term] ?? lowerFirst(humanize(term));
}

/** "three provisions" reads better than "3 provisions" at these sizes. */
const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

export function count(n: number, singular: string, plural = `${singular}s`): string {
  const word = n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
  return `${word} ${n === 1 ? singular : plural}`;
}

/** "a, b and c" — no serial comma, matching the memo's register. */
export function joinList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
