import { Reveal } from "@/components/site/reveal";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { PolicyTestCard } from "@/components/policy-test/policy-test-card";
import { POLICY_TEST_HREF, policyTestSummary } from "@/lib/policy-test";

/**
 * The Policy Test entry point on the homepage.
 *
 * One card, for the one reviewed pilot that exists. Nothing is shown for tests
 * that have not been reviewed and checked in, so the section never advertises
 * capability the repository cannot back.
 */
export function PolicyTestSection() {
  const summary = policyTestSummary();

  return (
    <Reveal as="section" className="border-t border-border">
      <div
        id="policy-test"
        className="mx-auto max-w-[76rem] scroll-mt-20 px-5 py-20 sm:px-6 lg:py-24"
      >
        <SectionLabel>Policy Test</SectionLabel>
        <SectionHeading className="mt-3 max-w-[20ch]">
          Run a policy question through Writ.
        </SectionHeading>
        <Prose className="mt-5">
          Each test is a reviewed methodology expressed in the DSL. Select one to inspect its rule,
          evidence and resulting assessment receipt.
        </Prose>

        <div className="mt-10 max-w-[54rem]">
          <PolicyTestCard
            href={POLICY_TEST_HREF}
            badge="Human-reviewed pilot"
            jurisdiction="EU · US federal"
            question="Is model evaluation legally required?"
            description="Tests whether a jurisdiction currently imposes a binding model-evaluation requirement on providers of advanced or general-purpose AI models."
            meta={[
              { label: "Reviewed source rows", value: String(summary.parentRowCount) },
              { label: "Normalized claims", value: String(summary.normalizedClaimCount) },
              { label: "Review status", value: "Human reviewed" },
            ]}
            action="Open policy test"
          />

          <p className="mt-5 max-w-[64ch] text-[0.85rem] leading-6 text-muted-foreground">
            Additional tests will appear only after their methodology and evidence have been
            reviewed and checked into the repository.
          </p>
        </div>
      </div>
    </Reveal>
  );
}
