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

  // Parameters that compose rather than compete. `record` chooses what the
  // inspector opens on; `jurisdiction` narrows the filter, and picks the record
  // too when none was named, which is how the homepage globe arrives here;
  // `example` seeds the workbench underneath and forces the disclosure open,
  // which is what the ⌘K entries and older links use.
  const requested = typeof params.record === "string" ? params.record : null;
  const initialJurisdiction =
    params.jurisdiction === "eu" ? "EU" : params.jurisdiction === "us" ? "US" : null;
  const resolution = resolveLabRecordId(requested, initialJurisdiction);
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
        initialJurisdiction={initialJurisdiction ?? "all"}
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
