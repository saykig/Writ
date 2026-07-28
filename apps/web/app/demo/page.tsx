import type { Metadata } from "next";

import { Demo, type DemoView, type RuleRow } from "@/components/demo/demo";
import { pilotPreviews } from "@/lib/pilot-assessments";
import { sourceFor, sourcingSummary } from "@/lib/pilot-sources";
import { instrumentLabel } from "@/lib/policy-test-format";
import { policyTestDataset, policyTestEvidenceEntries, policyTestSummary } from "@/lib/policy-test";

export const metadata: Metadata = {
  title: "Is model evaluation legally required? · Writ",
  description:
    "A human-reviewed pilot applying one explicit test to the European Union and United States federal policy corpus, quoting the official text behind each answer.",
};

export default function DemoPage() {
  const dataset = policyTestDataset();
  const entries = policyTestEvidenceEntries();
  const summary = policyTestSummary();
  const previews = pilotPreviews();

  // Every provision the answer was actually computed over: the ones traced to
  // the text of their source document. A row with nothing to quote never
  // entered the evaluation, so showing it here would overstate the record.
  const rows: RuleRow[] = entries
    .map((entry) => {
      // A source bundle groups its children and carries no legal force of its
      // own, so it is not a provision the rule can be applied to. Its children
      // appear on their own rows.
      if (entry.recordType === "source_bundle") return undefined;
      const sourced = sourceFor(entry.id) ?? sourceFor(entry.parentRowId);
      if (!sourced) return undefined;
      return {
        id: entry.id,
        place: entry.jurisdiction,
        label: `${instrumentLabel(entry.instrument)} · ${entry.sourceLocator}`,
        conditions: (entry.checks ?? []).map((check) => ({
          label: check.label,
          met: check.met,
          actual: check.actual,
        })),
        quote: sourced.passage.quote,
        citation: `${instrumentLabel(entry.instrument)}, ${entry.sourceLocator}`,
        uri: sourced.document.uri,
      };
    })
    .filter((row) => row !== undefined);

  const view: DemoView = {
    question: dataset.pilot_question,
    conditionLabels: (entries.find((entry) => entry.id === "EU-06")?.checks ?? []).map(
      (check) => check.label,
    ),
    rows,
    // The verdicts are produced by running the reviewed rule against each
    // jurisdiction's snapshot, not written here.
    verdicts: previews.map((preview) => ({
      place: preview.name,
      answer: preview.answer,
      note: preview.note,
      citations: [...preview.qualifying],
      considered: preview.consideredProvisions,
      untraced: preview.untraced,
    })),
    sourcing: sourcingSummary(summary.parentRowCount),
  };

  return <Demo view={view} />;
}
