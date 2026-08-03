import type { Metadata } from "next";

import { RecordInspector } from "@/components/lab/record-inspector";
import { TechnicalDetails } from "@/components/lab/technical-details";
import {
  labRecordChecks,
  labRecordSummaries,
  labRecordViews,
  resolveLabRecordId,
} from "@/lib/lab-record";
import { pilotEvidenceView } from "@/lib/toolchain";

export const metadata: Metadata = {
  title: "Lab · Writ",
  description:
    "How one exact source passage becomes one durable structured record: the passage, the record it was classified into, and what remains unknown.",
};

const VALID_EXAMPLES = new Set(["reviewed", "any-actor", "broad-conduct", "incomplete"]);

const CORPUS_LABEL = "EU–US AI evaluation pilot · human reviewed";

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Two parameters that compose rather than compete: `record` chooses what the
  // inspector opens on, `example` seeds the workbench underneath it and forces
  // the disclosure open, which is what the ⌘K entries and older links use.
  const requested = typeof params.record === "string" ? params.record : null;
  const resolution = resolveLabRecordId(requested);
  const initialView = params.view === "code" ? "code" : "guided";
  const rawExample = params.example;
  const initialExample =
    typeof rawExample === "string" && VALID_EXAMPLES.has(rawExample) ? rawExample : null;

  const views = labRecordViews();
  const checks = Object.fromEntries(
    views.map((view) => [view.claimId, labRecordChecks(view.claimId)]),
  );

  // No page header: the passage is the page.
  return (
    <main>
      <RecordInspector
        views={views}
        summaries={labRecordSummaries()}
        checks={checks}
        resolution={resolution}
        initialView={initialView}
        corpusLabel={CORPUS_LABEL}
        technicalDetails={
          <TechnicalDetails
            initialExample={initialExample}
            initialEvidence={pilotEvidenceView("eu")}
            defaultOpen={initialExample !== null}
          />
        }
      />
    </main>
  );
}
