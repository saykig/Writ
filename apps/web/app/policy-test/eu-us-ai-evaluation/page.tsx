import type { Metadata } from "next";

import { Reveal } from "@/components/site/reveal";
import { PolicyTestHero } from "@/components/policy-test/policy-test-hero";
import { PolicyTestWorkspace } from "@/components/policy-test/policy-test-workspace";
import { isStageId, type PolicyTestView, type StageId } from "@/components/policy-test/types";
import {
  humanize,
  policyTestEvidenceGroups,
  policyTestHighlights,
  policyTestReceipt,
  policyTestRuleConditions,
  policyTestSummary,
  policyTestDataset,
  scopeLabel,
} from "@/lib/policy-test";

export const metadata: Metadata = {
  title: "Where model evaluation is legally binding · Writ",
  description:
    "A human-reviewed pilot testing whether the European Union or United States federal policy corpus currently imposes a binding model-evaluation requirement on providers of advanced or general-purpose AI models.",
};

/**
 * The EU–US AI evaluation policy test.
 *
 * Every value on this page is read from the reviewed YAML annotation table at
 * build time. The stage is taken from the URL and validated here, on the server,
 * so an unknown value falls back to the first stage rather than rendering an
 * empty panel.
 */
export default async function PolicyTestPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const initialStage: StageId = isStageId(stage) ? stage : "methodology";

  const dataset = policyTestDataset();
  const summary = policyTestSummary();

  const view: PolicyTestView = {
    summary,
    methodology: {
      question: summary.pilotQuestion,
      includedScope: dataset.methodology.us_scope.included.map(scopeLabel),
      excludedScope: dataset.methodology.us_scope.excluded.map(scopeLabel),
      coreConductTypes: dataset.methodology.core_conduct_types.map(humanize),
    },
    ruleConditions: policyTestRuleConditions(),
    highlights: policyTestHighlights(),
    groups: policyTestEvidenceGroups(),
    receipt: policyTestReceipt(),
  };

  return (
    <main>
      <PolicyTestHero summary={summary} receipt={view.receipt} />

      <Reveal as="section" className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-16">
        <PolicyTestWorkspace view={view} initialStage={initialStage} />
      </Reveal>
    </main>
  );
}
