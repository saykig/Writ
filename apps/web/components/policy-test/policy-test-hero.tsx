import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/policy-test-format";
import type { PolicyTestReceipt, PolicyTestSummary } from "@/lib/policy-test";

/**
 * The page opening: the question, and the answer it already has.
 *
 * A researcher arriving here wants the finding, not a preamble. Both verdicts
 * are shown at the top with the evidence that produced them, and the stages
 * below are how you check the working.
 */
export function PolicyTestHero({
  summary,
  receipt,
}: {
  summary: PolicyTestSummary;
  receipt: PolicyTestReceipt;
}) {
  const verdicts = [
    {
      jurisdiction: "European Union",
      answer: "Yes, for one class",
      detail: statusLabel(receipt.eu.status),
      evidence: receipt.eu.decisiveEvidence,
      evidenceLabel: "Decisive",
      positive: true,
    },
    {
      jurisdiction: "United States — federal",
      answer: "Not cross-sector",
      detail: statusLabel(receipt.us.status),
      evidence: [],
      evidenceLabel: "Decisive",
      positive: false,
    },
  ];

  return (
    <header className="border-b border-border">
      <div className="mx-auto max-w-[76rem] px-5 py-14 sm:px-6 sm:py-16">
        <div className="grid grid-cols-1 gap-x-14 gap-y-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="min-w-0">
            <h1 className="max-w-[16ch] text-[length:var(--t-page)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance">
              Where model evaluation is legally binding.
            </h1>
            <p className="mt-5 max-w-[60ch] text-base leading-7 text-muted-foreground text-pretty">
              One explicit rule, applied to the European Union and United States federal policy
              corpus, over reviewed evidence.
            </p>

            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              {[
                { label: "Reviewed rows", value: String(summary.parentRowCount) },
                { label: "Normalized claims", value: String(summary.normalizedClaimCount) },
                { label: "Pending review", value: String(summary.pendingReviewCount) },
                { label: "Schema", value: summary.schemaVersion, mono: true },
              ].map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="label">{item.label}</dt>
                  <dd
                    className={cn(
                      "mt-1 text-[0.95rem] font-medium",
                      item.mono ? "font-mono text-[0.85rem]" : "tabular-nums",
                    )}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 font-mono text-[0.72rem] text-muted-foreground/70 break-all">
              {summary.datasetId}
            </p>
          </div>

          {/* The answer, before the working. */}
          <div className="min-w-0">
            <p className="label">Result</p>
            <ul className="mt-3 space-y-2">
              {verdicts.map((verdict) => (
                <li
                  key={verdict.jurisdiction}
                  className={cn(
                    "rounded-xl border p-4",
                    verdict.positive ? "border-primary/30 bg-primary/[0.06]" : "border-border",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="label">{verdict.jurisdiction}</span>
                    {verdict.evidence.length > 0 ? (
                      <span className="font-mono text-[0.72rem] text-primary">
                        {verdict.evidence.join(", ")}
                      </span>
                    ) : (
                      <span className="text-[0.72rem] text-muted-foreground">no match</span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-[1.05rem] leading-snug font-semibold",
                      verdict.positive ? "text-primary" : "text-foreground",
                    )}
                  >
                    {verdict.answer}
                  </p>
                  <p className="mt-1 text-[0.8rem] leading-5 text-muted-foreground">
                    {verdict.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </header>
  );
}
