// The governed methodology inventory for the AI-for-SMEs chapter.
//
// A structured, schema-valid (`methodology-inventory`) capture of the report's
// commitment text, definitions, the strong / weak / countervailing
// classification, the score table, and the "up to four strong" prose/metric
// anomaly that the resolved covenant fixes with rule priorities.

import type { MethodologyInventory } from "@covenant/domain";
import { MEMBERS } from "./members.js";
import { SOURCE_SHA256, SOURCE_URI } from "./evidence.js";

/** Build the methodology-inventory document for the AI-for-SMEs chapter. */
export function buildMethodologyInventory(): MethodologyInventory {
  const observed_results = Object.fromEntries(
    MEMBERS.map((member) => [member.id, member.published]),
  ) as MethodologyInventory["observed_results"];

  return {
    schema_version: "1.0.0",
    id: "methodology-2025-ai-sme",
    commitment_id: "AI_SME_ADOPTION",
    chapter: {
      title: "Digital Economy: Artificial Intelligence for Small and Medium-Sized Enterprises",
      uri: SOURCE_URI,
      report_year: 2025,
      page_range: "170-192",
      content_hash: SOURCE_SHA256,
    },
    subjects: MEMBERS.map((member) => member.id) as [string, ...string[]],
    evaluation_window: { start: "2025-06-18", end: "2026-06-01" },
    commitment_text:
      "We commit to … sustain investments in AI [artificial intelligence] adoption programs for SMEs [small and medium-sized enterprises], including supporting access to compute and digital infrastructure.",
    definitions: [
      {
        term: "Sustain",
        definition:
          "Keeping up, prolonging, or supporting something with the intent of continuing to supply it with sustenance; here, the continuation of support for investments in AI adoption programs for SMEs.",
        source_passage_ids: ["passage-commitment-text"],
      },
      {
        term: "Adoption",
        definition:
          "The act of beginning to practice or use something; here, the practice of SMEs beginning to use AI technology in their systems.",
        source_passage_ids: ["passage-commitment-text"],
      },
      {
        term: "Access",
        definition:
          "Availability defined by reachability (physical), affordability (economic), and acceptability (socio-cultural); here, the availability and access of compute and digital infrastructure.",
      },
      {
        term: "Compute and digital infrastructure",
        definition:
          "The foundational set of technologies — including compute, storage, and networks — that support digital services, platforms, and applications.",
      },
    ],
    classifications: [
      {
        label: "strong",
        description: "Actions that sustain investments in SME-targeted AI adoption programs.",
        examples: [
          "allocating funding for SME AI adoption",
          "enacting legislation that facilitates integration",
          "establishing privacy or consumer protection frameworks",
          "subsidizing access to compute and digital infrastructure",
          "creating SME-specific training centers",
          "publishing toolkits or case studies",
          "supporting talent exchanges",
          "financing that expands SME AI access, global infrastructure or compute programs, cross-border partnerships, literacy campaigns, or benefiting SMEs in developing economies (international)",
        ],
        source_passage_ids: ["passage-definition-strong"],
      },
      {
        label: "weak",
        description: "Weaker actions that do not durably sustain SME-targeted AI investment.",
        examples: [
          "attending conferences",
          "issuing verbal statements of support",
          "endorsing other countries' SME AI policies",
          "launching short-term pilots or one-off grants",
          "hosting awareness events without resources",
          "providing outdated or impractical tools",
        ],
        exclusions: ["general AI programs not tailored to SMEs"],
        source_passage_ids: ["passage-definition-weak"],
      },
      {
        label: "countervailing",
        description:
          "Acts that counter investments in AI adoption programs; a single such act caps the score at −1.",
        source_passage_ids: ["passage-scoring-guidelines"],
      },
    ],
    score_guideline: {
      prose:
        "+1 is awarded to members that take at least five strong actions. 0 is assigned to members that have taken three or four weak actions, or up to four strong actions. −1 is assigned if a member takes two or fewer weak actions, or acts in ways that counter investments in AI adoption programs.",
      normalized_branches: [
        {
          result: "+1",
          condition_text: "five or more strong actions",
          source_passage_ids: ["passage-scoring-guidelines"],
        },
        {
          result: "0",
          condition_text:
            "three or four weak actions, or one to four strong actions (see prose/metric anomaly)",
          source_passage_ids: ["passage-scoring-guidelines"],
        },
        {
          result: "-1",
          condition_text:
            "two or fewer weak actions and no strong actions, or any countervailing act",
          source_passage_ids: ["passage-scoring-guidelines"],
        },
      ],
    },
    observed_results,
    open_questions: [
      {
        id: "oq-up-to-four-strong",
        question:
          "The 0 branch reads 'up to four strong actions', which literally includes zero strong actions and does not bound the weak count; the −1 branch reads 'two or fewer weak actions'. Taken literally these overlap at (strong=0, low weak) and leave (strong=0, weak≥5) uncovered — a prose/metric mismatch.",
        category: "prose_metric_mismatch",
        blocking: false,
        proposed_resolution:
          "The resolved covenant reads the 0 branch as requiring at least one strong action (strong in 1..4), and separately assigns strong=0 with weak≥3 to 0, leaving strong=0 with weak≤2 to −1. Rule priorities make the counteraction override and the full-compliance branch decisive, yielding an exhaustive, non-overlapping score program (no COV-SCORE-GAP / -OVERLAP).",
      },
      {
        id: "oq-general-ai-measures",
        question:
          "Do general, non-SME-targeted AI laws and national AI strategy documents count as strong 'legislation that facilitates integration', or as weak 'general AI programs not tailored to SMEs'? The call is decisive for Japan and the United States.",
        category: "definition",
        blocking: false,
        proposed_resolution:
          "The published profile reads them as weak (reproducing Japan 0 and United States 0); the generous profile reads them as strong (flipping Japan, and the US, to +1). The difference is recorded in the discrepancy ledger as implicit analyst interpretation.",
      },
    ],
    review_status: "reviewed",
    reviewer_ids: ["mehek-berry", "isabella-chan-combrink"],
    notes:
      "Per-member action evidence, dates, and page anchors are frozen in the evidence snapshots under evidence/. Analysts: Compliance Director Mehek Berry; Lead Analyst Isabella Chan-Combrink.",
  };
}
