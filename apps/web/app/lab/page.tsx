import type { Metadata } from "next";

import { WritLab } from "@/components/lab/writ-lab";
import { pilotEvidenceView } from "@/lib/toolchain";

export const metadata: Metadata = {
  title: "Writ Lab · Writ",
  description:
    "Inspect a saved query across independent corpora, change its interpretation, and trace derived judgments to reviewed records.",
};

const VALID_EXAMPLES = new Set(["reviewed", "any-actor", "broad-conduct", "incomplete"]);

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.example;
  const initialExample = typeof raw === "string" && VALID_EXAMPLES.has(raw) ? raw : null;
  const initialEvidence = pilotEvidenceView("eu");

  // No page header: the tool is the page. The readings and their effects are
  // named in the chooser, which is where the reading is actually made.
  return (
    <main>
      <WritLab initialExample={initialExample} initialEvidence={initialEvidence} />
    </main>
  );
}
