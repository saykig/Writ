import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Reveal } from "@/components/site/reveal";
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
  title: "Is model evaluation legally required? · Writ",
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

  const meta: { label: string; value: string; mono?: boolean }[] = [
    { label: "Dataset", value: summary.datasetId, mono: true },
    { label: "Schema", value: summary.schemaVersion, mono: true },
    { label: "Review status", value: "Human reviewed" },
    { label: "Reviewed source rows", value: String(summary.parentRowCount) },
    { label: "Normalized claims", value: String(summary.normalizedClaimCount) },
  ];

  return (
    <main>
      {/* Same band, container, and type scale as PageHeader, with the badge and
          reviewed metadata this pilot needs. */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
          <p className="label">Advanced AI governance pilot</p>
          <h1 className="mt-4 max-w-[18ch] text-[length:var(--t-page)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance">
            Is model evaluation legally required?
          </h1>
          <p className="mt-5 max-w-[68ch] text-base leading-7 text-muted-foreground text-pretty">
            This pilot tests whether the same explicit policy rule can be applied consistently
            across the European Union and United States federal policy corpus.
          </p>

          <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {meta.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="label">{item.label}</dt>
                <dd
                  className={`mt-1.5 min-w-0 text-[0.9rem] font-medium break-words ${
                    item.mono ? "font-mono text-[0.8rem]" : "tabular-nums"
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-9">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-[0.85rem] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back to homepage
            </Link>
          </div>
        </div>
      </header>

      <Reveal as="section" className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-20">
        <PolicyTestWorkspace view={view} initialStage={initialStage} />
      </Reveal>
    </main>
  );
}
