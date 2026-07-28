import type { Metadata } from "next";

import { PolicyTest, type PolicyTestView } from "@/components/policy-test/policy-test";
import {
  policyTestDataset,
  policyTestEvidenceGroups,
  policyTestHighlights,
  policyTestReceipt,
  policyTestRuleConditions,
  policyTestSummary,
  scopeLabel,
} from "@/lib/policy-test";

export const metadata: Metadata = {
  title: "Where model evaluation is legally binding · Writ",
  description:
    "A human-reviewed pilot testing whether the European Union or United States federal policy corpus currently imposes a binding model-evaluation requirement on providers of advanced or general-purpose AI models.",
};

/**
 * Loads the reviewed pilot and hands it to the one component that renders it.
 * Everything here comes from the YAML annotation table, parsed at build time.
 */
export default function PolicyTestPage() {
  const dataset = policyTestDataset();

  const view: PolicyTestView = {
    summary: policyTestSummary(),
    includedScope: dataset.methodology.us_scope.included.map(scopeLabel),
    excludedScope: dataset.methodology.us_scope.excluded.map(scopeLabel),
    ruleConditions: policyTestRuleConditions(),
    highlights: policyTestHighlights(),
    groups: policyTestEvidenceGroups(),
    receipt: policyTestReceipt(),
  };

  return <PolicyTest view={view} />;
}
