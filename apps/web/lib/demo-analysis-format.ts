/**
 * Presentation helpers for the demo-analysis data.
 *
 * Deliberately free of Node imports so client components can use them: the
 * server-only module (`lib/demo-analysis.ts`) reaches for `node:crypto` through
 * `@writ/provenance`, which must never reach the browser bundle.
 *
 * Nothing here changes what a value says. These functions fix word separators,
 * casing, and date formatting only, and `unknown` is always returned verbatim.
 */

export type Jurisdiction = "EU" | "US";

/**
 * Fields shared by a reviewed parent row and a derived claim.
 *
 * Declared here rather than beside the reader so that presentation code can name
 * a field without importing the server-only module. The declaration order is
 * also the fallback display order for fields the guided view does not name.
 */
export interface ClaimFields {
  record_type: string;
  legal_force?: string;
  compliance_function?: string;
  adoption_status?: string;
  applicability_status?: string;
  enforcement_status?: string;
  headline_relevance?: string;
  actor_type?: string;
  actor_term_local?: string;
  actor_relationship?: string;
  target_actor?: string;
  recipient_actor_type?: string;
  recipient_actor_term_local?: string;
  indirectly_affected_actor_type?: string;
  additional_affected_actor_type?: string;
  additional_actor_term_local?: string;
  current_actor_type?: string;
  current_actor_term_local?: string;
  prospective_actor_type?: string;
  prospective_actor_term_local?: string;
  defined_actor_class?: string;
  excluded_direct_actor_types?: string[];
  conduct_type?: string;
  conduct_term_local?: string;
  conduct_family?: string;
  evaluation_method?: string[];
  required_vendor_conduct?: string[];
  noncompliance_consequence?: string;
  source_actions?: string[];
  source_lifecycle_activities?: string[];
  source_topics?: string[];
  framework_functions?: string[];
  proposal_action?: string;
  binding_scope?: string;
  scope?: string[];
  covered_scope?: string[];
  target_system?: string;
  responsible_authority?: string;
  responsible_authorities?: string[];
  potential_responsible_authorities?: string[];
  additional_authority?: string;
  implementation_body?: string;
  policy_authority?: string;
  policy_origin?: string;
  exception_scope_local?: string;
  exception_target?: string[];
  exception_conditions_status?: string;
  source_legal_force_label?: string;
  underlying_regime_force?: string;
  underlying_instrument?: string;
  source_instrument_force?: string;
  described_obligation_force?: string;
  classification_indicators?: Record<string, string>;
  effective_from?: string;
  compliance_deadline?: string;
  instrument?: string;
}

export interface DerivedClaim extends ClaimFields {
  claim_id: string;
}

export interface ReviewedRecord extends ClaimFields {
  row_id: string;
  review_decision: "accepted";
  jurisdiction: Jurisdiction;
  instrument: string;
  source_locator: string;
  interpretation_note: string;
  derived_claims?: DerivedClaim[];
}

/** Compounds the reviewers wrote with underscores but that read as hyphenated. */
const HYPHENATED = ["general purpose", "pre deployment", "cross sector", "high impact"] as const;

/** Initialisms that must not be sentence-cased into ordinary words. */
const INITIALISMS = ["ai", "gpai", "eu", "us", "nist", "caisi", "omb", "ftc", "fcc"] as const;

export function humanize(token: string): string {
  if (token === "unknown") return "unknown";

  let text = token.replace(/_/g, " ").toLowerCase();
  for (const compound of HYPHENATED) {
    text = text.replaceAll(compound, compound.replace(" ", "-"));
  }
  for (const initialism of INITIALISMS) {
    text = text.replace(new RegExp(`\\b${initialism}\\b`, "g"), initialism.toUpperCase());
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Display names for the stored instrument identifiers. Presentation only: the
 * identifier in the data is unchanged, and no instrument is added or renamed.
 */
const INSTRUMENT_LABELS: Record<string, string> = {
  EU_AI_ACT: "AI Act",
  COMMISSION_GPAI_GUIDELINES: "Commission GPAI guidelines",
  GPAI_CODE_OF_PRACTICE_SIGNATORY_NOTICE: "GPAI Code of Practice signatory notice",
  NIST_AI_RMF: "NIST AI RMF",
  NIST_AI_RMF_PLAYBOOK: "NIST AI RMF Playbook",
  NIST_GENERATIVE_AI_PROFILE: "NIST Generative AI Profile",
  CAISI_OVERVIEW: "CAISI overview",
  CAISI_GUIDELINES_PAGE: "CAISI guidelines",
  CAISI_EVALUATION_GUIDELINES: "CAISI evaluation guidelines",
  CAISI_DRAFT_BENCHMARK_PRACTICES: "CAISI draft benchmark practices",
  WHITE_HOUSE_AI_EXECUTIVE_POLICY: "White House AI executive policy",
  WHITE_HOUSE_AI_FRAMEWORK_FACT_SHEET: "White House AI framework fact sheet",
  WHITE_HOUSE_AI_POLICY_ACTION_MATERIALS: "White House AI policy-action materials",
  OMB_M_25_21: "OMB M-25-21",
  OMB_M_25_22: "OMB M-25-22",
};

export function instrumentLabel(instrument: string): string {
  return INSTRUMENT_LABELS[instrument] ?? instrument;
}

/**
 * Display names for the scope terms in `methodology.us_scope`. Presentation
 * only: which terms appear, and in which list, is read from the reviewed file.
 */
const SCOPE_LABELS: Record<string, string> = {
  cross_sector: "Cross-sector policy",
  government_use: "Government use",
  government_procurement: "Government procurement",
  national_security_only: "National-security-only authorities",
};

export function scopeLabel(term: string): string {
  return SCOPE_LABELS[term] ?? humanize(term);
}

/**
 * Readable renderings of the stored headline-judgment tokens. Keyed by the token
 * so a change in the reviewed file cannot leave a stale sentence behind: an
 * unrecognised token falls back to its own words rather than to a stale label.
 */
const STATUS_LABELS: Record<string, string> = {
  binding_applicable_for_defined_class: "Binding and applicable for a defined provider class",
  no_current_binding_model_evaluation_requirement:
    "No current cross-sector binding provider requirement",
};

export function statusLabel(token: string): string {
  return STATUS_LABELS[token] ?? humanize(token);
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `2027-08-02` becomes `2 August 2027`. Returns the input if it is not a date. */
export function formatReviewedDate(iso: string | null): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}
