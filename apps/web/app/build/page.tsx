import type { Metadata } from "next";

import { Builder } from "@/components/build/builder";
import { buildVocabulary } from "@/lib/build-vocabulary";

export const metadata: Metadata = {
  title: "Build a corpus · Writ",
  description:
    "Turn a source passage into a structured draft record through five guided steps, using the reviewed corpus's own vocabulary and without writing YAML.",
};

export default function BuildPage() {
  // The vocabulary is read from the reviewed corpus on the server, so the form
  // can only offer terms the data already uses.
  return (
    <main>
      <Builder vocabulary={buildVocabulary()} />
    </main>
  );
}
