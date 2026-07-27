/**
 * The view model handed from the server page to the policy-test client
 * components. Following the house rule, client components never receive domain
 * objects: everything here is plain, serializable, and already shaped for
 * display, while still carrying the reviewers' distinctions intact.
 */

import type {
  EvidenceGroup,
  HighlightedEvidence,
  PolicyTestReceipt,
  PolicyTestSummary,
  RuleCondition,
} from "@/lib/policy-test";

export type { EvidenceEntry, EvidenceField, EvidenceGroup } from "@/lib/policy-test";

export const STAGES = [
  {
    id: "methodology",
    label: "Methodology",
    heading: "Define the question before running it.",
  },
  {
    id: "rule",
    label: "Explicit rule",
    heading: "Writ converts the question into a testable condition.",
  },
  {
    id: "evidence",
    label: "Reviewed evidence",
    heading: "The rule runs only against accepted, human-reviewed records.",
  },
  {
    id: "receipt",
    label: "Assessment receipt",
    heading: "The result preserves the legal differences between the two systems.",
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_IDS = STAGES.map((stage) => stage.id) as readonly StageId[];

export function isStageId(value: string | undefined): value is StageId {
  return value !== undefined && (STAGE_IDS as readonly string[]).includes(value);
}

export interface MethodologyView {
  question: string;
  includedScope: string[];
  excludedScope: string[];
  coreConductTypes: string[];
}

export interface PolicyTestView {
  summary: PolicyTestSummary;
  methodology: MethodologyView;
  ruleConditions: RuleCondition[];
  highlights: HighlightedEvidence[];
  groups: EvidenceGroup[];
  receipt: PolicyTestReceipt;
}
