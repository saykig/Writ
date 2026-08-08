import type { Metadata } from "next";

import { HowItWorksStory } from "@/components/how-it-works/how-it-works-story";

export const metadata: Metadata = {
  title: "Start Here · Writ",
  description:
    "Follow one exact source passage through an atomic record, human review, a corpus, a query, and a result that remains traceable to its evidence.",
};

/**
 * THESIS: One real sentence moves through Writ without losing its source.
 * OWN-WORLD: Near-black instrument field, white type, fine rules, and restrained blue state.
 * STORY: Source → passage → record → review → corpus → query → result with provenance.
 * FIRST VIEWPORT: A plain-language promise beside the complete seven-stage route.
 * FORM: A persistent systems canvas guided by a numbered narrative rail.
 */
export default function StartHerePage() {
  return <HowItWorksStory />;
}
