import type { Metadata } from "next";

import { Playground } from "@/components/playground/playground";

export const metadata: Metadata = {
  title: "Playground · Writ",
  description:
    "One question, asked four ways. Each reading is a real rule that runs against the European Union and United States provisions traced to their source text.",
};

const VALID_EXAMPLES = new Set(["reviewed", "any-actor", "broad-conduct", "incomplete"]);

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.example;
  const initialExample = typeof raw === "string" && VALID_EXAMPLES.has(raw) ? raw : null;

  // No page header: the tool is the page. The readings and their effects are
  // named in the chooser, which is where the reading is actually made.
  return (
    <main>
      <Playground initialExample={initialExample} />
    </main>
  );
}
