import type { Metadata } from "next";

import { Playground } from "@/components/playground/playground";

export const metadata: Metadata = {
  title: "Playground — Covenant",
  description:
    "Write a methodology in the Covenant DSL and watch it compile, get analyzed for scoring gaps and overlaps, and evaluate against a frozen member snapshot into a receipt.",
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

  return <Playground initialExample={initialExample} />;
}
