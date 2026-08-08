import type { Metadata } from "next";

import { HowItWorksStory } from "@/components/how-it-works/how-it-works-story";

export const metadata: Metadata = {
  title: "Start Here · Writ",
  description:
    "Follow source material through an exact passage, a structured record, human review and into a corpus without losing its provenance.",
};

/**
 * THESIS: One real sentence moves through Writ without losing its source.
 * OWN-WORLD: Near-black instrument field, white type, fine rules, and restrained blue state.
 * STORY: Source → passage → record → review → corpus with provenance.
 * FIRST VIEWPORT: A plain-language promise beside the complete five-stage route.
 * FORM: A persistent systems canvas guided by a numbered narrative rail.
 */
export default function StartHerePage() {
  return <HowItWorksStory />;
}
