import type { Metadata } from "next";

import { Playground } from "@/components/playground/playground";
import { PageHeader } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Writ Lab · Writ",
  description:
    "Write a methodology in the Writ DSL and watch it compile, get analyzed for scoring gaps and overlaps, and evaluate against a frozen member snapshot into a receipt.",
};

const VALID_EXAMPLES = new Set(["literal", "resolved", "inclusive"]);

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.example;
  const initialExample = typeof raw === "string" && VALID_EXAMPLES.has(raw) ? raw : null;

  return (
    <main>
      <PageHeader
        eyebrow="Writ Lab"
        title="Write and test a policy methodology."
        description="The Writ Lab shows how Writ turns a written methodology into rules that can be checked and run. You can revise the example, review any problems in the logic, and see how the final result is produced."
      />
      <Playground initialExample={initialExample} />
    </main>
  );
}
