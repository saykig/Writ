"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";

import { Button } from "@/components/ui/button";
import { WritSystemCanvas } from "@/components/how-it-works/writ-system-canvas";
import { STORY_STAGES, type StoryStage } from "@/components/how-it-works/story-types";

interface StoryStageDefinition {
  readonly id: StoryStage;
  readonly label: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly aside?: string;
}

type FoundationId =
  | "knowledge-model"
  | "evidence-provenance"
  | "corpus-families"
  | "writ-language"
  | "schemas"
  | "parser-compiler"
  | "fingerprints"
  | "conformance";

interface FoundationTopic {
  readonly id: FoundationId;
  readonly title: string;
  readonly summary: string;
  readonly detail: readonly string[];
}

const PIPELINE = ["SOURCE", "PASSAGE", "RECORD", "REVIEW", "CORPUS", "QUERY", "RESULT"];

const STAGES: readonly StoryStageDefinition[] = [
  {
    id: "source",
    label: "Source",
    title: "Start with the source.",
    body: [
      "A source may be a law, regulation, official webpage, institutional document or another piece of reviewed research material.",
      "Writ stores the document version and its content fingerprint before it makes any claim about what the document means.",
    ],
    aside: "Writ starts from something that already exists.",
  },
  {
    id: "passage",
    label: "Passage",
    title: "Keep the exact words.",
    body: [
      "Writ does not treat an entire document as one claim. It preserves the exact quotation, its location, the document version, and fingerprints for both the passage and document.",
      "This lets another person see exactly which words support the record.",
    ],
  },
  {
    id: "record",
    label: "Record",
    title: "One record, one supported fact.",
    body: [
      "The selected passage becomes an atomic record: here, one placement fact stating where NIST sits organizationally.",
      "Identity, placement and mission may concern the same institution, but they are not the same kind of claim.",
    ],
    aside: "mission ≠ mandate · function ≠ capacity · placement ≠ authority",
  },
  {
    id: "review",
    label: "Review",
    title: "Models may propose. People decide.",
    body: [
      "A model can identify a passage or propose a structured record. That does not make the proposal an accepted fact.",
      "A person may approve, revise or reject it. The decision is stored separately from the evidence and from the record’s creation history.",
    ],
    aside: "An accepted judgment and an approved record are related, but distinct, states.",
  },
  {
    id: "corpus",
    label: "Corpus",
    title: "Records live in families.",
    body: [
      "The approved placement record joins the NIST institutional corpus. Institutional records describe institutions; legal-policy records describe laws, rules, policies and governing instruments.",
      "The two families can refer to each other without becoming the same thing. Missing evidence remains not established—not silently false.",
    ],
  },
  {
    id: "query",
    label: "Query",
    title: "Then ask the corpus a question.",
    body: [
      "A query asks a reproducible question over records that already exist. It does not create a new source or turn the question into the corpus’s identity.",
      "Relevant reviewed records become active; unrelated records stay quiet and intact.",
    ],
  },
  {
    id: "result",
    label: "Result",
    title: "The answer still points back.",
    body: [
      "The result is readable on its own, but Writ keeps the chain beneath it: record, human judgment, passage, document version and original source.",
      "If stored content changes, its fingerprint changes. Review and supersession history remain visible rather than being rewritten away.",
    ],
    aside: "Nothing should lose where it came from.",
  },
];

const FOUNDATION_TOPICS: readonly FoundationTopic[] = [
  {
    id: "knowledge-model",
    title: "Knowledge model",
    summary: "What Writ stores, and how sources, records, corpora and results connect.",
    detail: [
      "Writ does not treat a document, a claim and an institution as the same thing. It gives each one a place in the system and keeps the relationships between them explicit.",
      "Institutional records also keep identity, placement, mission, mandate, function, decision rights and operational capacity as separate fact types. Evidence for one does not establish the others.",
    ],
  },
  {
    id: "evidence-provenance",
    title: "Evidence and provenance",
    summary: "How records stay connected to the exact words and sources that support them.",
    detail: [
      "Every record should still be able to answer: what exact words support this, where did they come from, and what version of the source was reviewed?",
      "A record’s evidence reference stores the passage, its location, the document version and fingerprints for both the passage and document.",
    ],
  },
  {
    id: "corpus-families",
    title: "Corpus families",
    summary: "Why institutional records and legal-policy records are kept separate.",
    detail: [
      "Different kinds of things need different kinds of records. The families share a small record base, then add fields suited to what they describe.",
      "They can refer to each other without becoming the same thing.",
    ],
  },
  {
    id: "writ-language",
    title: ".writ",
    summary: "The typed language used to express records, evidence, scope and queries.",
    detail: [
      ".writ is the typed language Writ uses to express structured records and queries.",
      "This excerpt comes from the current NIST institutional corpus. The record name and family are part of the language itself.",
    ],
  },
  {
    id: "schemas",
    title: "Schemas",
    summary: "The rules that determine what a valid Writ record can contain.",
    detail: [
      "Schemas define what fields a record is allowed or required to have.",
      "Every record shares fields for identity, evidence, uncertainty, provenance and review state. Each corpus family can then require fields that make sense for its own material.",
    ],
  },
  {
    id: "parser-compiler",
    title: "Parser and compiler",
    summary: "How Writ checks the language before it runs a query.",
    detail: [
      "Before Writ runs a query, it can check whether the language is structurally valid. The parser reads the syntax; the compiler turns valid declarations into normalized records and analysis objects.",
      "This check is deterministic. It does not require a model, a database or network access to decide whether the syntax is valid.",
    ],
  },
  {
    id: "fingerprints",
    title: "Fingerprints",
    summary: "How Writ can tell when stored source material has changed.",
    detail: [
      "A fingerprint is a hash of stored content. If the content changes, the fingerprint changes too.",
      "That gives Writ a way to notice that the evidence being reviewed is no longer byte-for-byte the same evidence.",
    ],
  },
  {
    id: "conformance",
    title: "Conformance",
    summary: "How fixtures and tests keep the language behaving consistently across versions.",
    detail: [
      "Conformance tests make sure the same valid input keeps producing the same expected behavior as Writ changes.",
      "The fixtures exercise parsing, canonicalization, diagnostics, quantities, time, truth values and proof behavior. Mutation tests check that the suite notices when an expected result is changed.",
    ],
  },
];

function StageNarrative({
  stage,
  index,
  active,
}: {
  stage: StoryStageDefinition;
  index: number;
  active: boolean;
}) {
  return (
    <section
      className="hiw-story-step"
      data-active={active ? "true" : "false"}
      aria-labelledby={`hiw-${stage.id}-title`}
    >
      <div className="hiw-story-step-copy">
        <p className="hiw-story-step-index">
          <span>{String(index + 1).padStart(2, "0")}</span>
          {stage.label}
        </p>
        <h2 id={`hiw-${stage.id}-title`}>{stage.title}</h2>
        {stage.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {stage.aside ? <p className="hiw-story-aside">{stage.aside}</p> : null}
      </div>
      <div className="hiw-mobile-canvas" aria-hidden="true">
        <WritSystemCanvas activeStage={stage.id} compact />
      </div>
    </section>
  );
}

function FoundationExtra({ id }: { id: FoundationId }) {
  if (id === "knowledge-model") {
    return (
      <div className="hiw-foundation-flows" aria-label="Knowledge model relationships">
        <div>
          {["Source", "Passage", "Record", "Corpus", "Query", "Result"].map(
            (item, index, items) => (
              <span key={item}>
                <strong>{item}</strong>
                {index < items.length - 1 ? <i aria-hidden>→</i> : null}
              </span>
            ),
          )}
        </div>
        <div>
          {[
            "Institution",
            "identity",
            "placement",
            "mission",
            "mandate",
            "function",
            "capacity",
          ].map((item, index, items) => (
            <span key={item}>
              <strong>{item}</strong>
              {index < items.length - 1 ? <i aria-hidden>→</i> : null}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (id === "evidence-provenance") {
    return (
      <div className="hiw-foundation-flow" aria-label="Evidence trace">
        {["record", "passage", "document version", "source"].map((item, index, items) => (
          <span key={item}>
            <strong>{item}</strong>
            {index < items.length - 1 ? <i aria-hidden>→</i> : null}
          </span>
        ))}
      </div>
    );
  }

  if (id === "corpus-families") {
    return (
      <dl className="hiw-foundation-definitions">
        <div>
          <dt>institutional</dt>
          <dd>describes institutions</dd>
        </div>
        <div>
          <dt>legal_policy</dt>
          <dd>describes laws, policies, rules and governing instruments</dd>
        </div>
      </dl>
    );
  }

  if (id === "writ-language") {
    return (
      <pre className="hiw-foundation-code" aria-label="Excerpt from the NIST records.writ file">
        <code>{`record nist_organizational_placement : institutional {
  corpus us.institutions.nist;
  version "0.2.0";
  title "NIST organizational placement";`}</code>
      </pre>
    );
  }

  return null;
}

function TechnicalFoundations() {
  const [openFoundation, setOpenFoundation] = useState<FoundationId | null>(null);

  return (
    <section className="hiw-technical" aria-labelledby="hiw-technical-title">
      <header>
        <h2 id="hiw-technical-title">Technical foundations</h2>
        <p>The parts underneath Writ, if you want to see how it actually works.</p>
      </header>

      <div className="hiw-foundation-list">
        {FOUNDATION_TOPICS.map((topic) => {
          const isOpen = openFoundation === topic.id;
          const titleId = `hiw-foundation-${topic.id}-title`;
          const panelId = `hiw-foundation-${topic.id}-panel`;

          return (
            <article
              key={topic.id}
              className="hiw-foundation"
              data-open={isOpen ? "true" : "false"}
            >
              <button
                type="button"
                className="hiw-foundation-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() =>
                  setOpenFoundation((current) => (current === topic.id ? null : topic.id))
                }
              >
                <strong id={titleId}>{topic.title}</strong>
                <span>{topic.summary}</span>
                <ArrowRight aria-hidden />
              </button>

              <div
                id={panelId}
                className="hiw-foundation-panel"
                role="region"
                aria-labelledby={titleId}
                aria-hidden={!isOpen}
                data-open={isOpen ? "true" : "false"}
              >
                <div>
                  <div className="hiw-foundation-body">
                    {topic.detail.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    <FoundationExtra id={topic.id} />
                    <button
                      type="button"
                      className="hiw-foundation-close"
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => setOpenFoundation(null)}
                    >
                      Close <span aria-hidden>↑</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function HowItWorksStory() {
  const storyRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start center", "end center"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (reduceMotion) return;
    const next = Math.min(STORY_STAGES.length - 1, Math.floor(latest * STORY_STAGES.length));
    setActiveIndex((current) => (current === next ? current : next));
  });

  const activeStage = STORY_STAGES[activeIndex];

  return (
    <main className="hiw-page">
      <header className="hiw-opening">
        <div className="hiw-opening-copy">
          <p className="hiw-kicker">Start Here · How it works</p>
          <h1>Writ keeps the source, the claim, the review and the answer connected.</h1>
          <p>
            Writ breaks research material into small, reviewable records. Those records are
            organized into corpora and can be queried without losing the evidence they came from.
          </p>
        </div>

        <ol className="hiw-opening-pipeline" aria-label="Writ knowledge pipeline">
          {PIPELINE.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
              {index < PIPELINE.length - 1 ? <ArrowDown aria-hidden /> : null}
            </li>
          ))}
        </ol>
      </header>

      <div ref={storyRef} className="hiw-story">
        <nav className="hiw-stage-rail" aria-label="How Writ works stages">
          <ol>
            {STAGES.map((stage, index) => (
              <li key={stage.id} data-active={index === activeIndex ? "true" : "false"}>
                <a
                  href={`#hiw-${stage.id}-title`}
                  aria-current={index === activeIndex ? "step" : undefined}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {stage.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="hiw-narrative">
          {STAGES.map((stage, index) => (
            <StageNarrative
              key={stage.id}
              stage={stage}
              index={index}
              active={index === activeIndex}
            />
          ))}
        </div>

        <div className="hiw-desktop-canvas">
          <WritSystemCanvas activeStage={activeStage} />
        </div>
      </div>

      <section className="hiw-families" aria-labelledby="hiw-families-title">
        <div className="hiw-section-intro">
          <p className="hiw-kicker">Shared grammar, distinct meaning</p>
          <h2 id="hiw-families-title">
            The same grammar, without pretending the institutions are the same.
          </h2>
          <p>
            Shared record types make evidence structurally comparable. The evidence still determines
            what each institution means within that language.
          </p>
        </div>
        <div className="hiw-alignment" aria-label="Schematic institutional record comparison">
          <div className="hiw-alignment-head">
            <span>NIST</span>
            <small>federal_agency</small>
          </div>
          <div className="hiw-alignment-guide" aria-hidden />
          <div className="hiw-alignment-slots">
            {[
              ["identity", "established"],
              ["placement", "established"],
              ["mission", "established"],
            ].map(([label, status]) => (
              <div key={label}>
                <span>{label}</span>
                <small>{status}</small>
              </div>
            ))}
          </div>
          <div className="hiw-alignment-not-equal">
            same schema <strong>≠</strong> same authority
          </div>
          <div className="hiw-alignment-slots" data-generic="true">
            {[
              ["identity", "shared slot"],
              ["placement", "shared slot"],
              ["mission", "shared slot"],
            ].map(([label, status]) => (
              <div key={label}>
                <span>{label}</span>
                <small>{status}</small>
              </div>
            ))}
          </div>
          <div className="hiw-alignment-head hiw-alignment-head--end">
            <span>European institution</span>
            <small>institution type remains distinct</small>
          </div>
        </div>
      </section>

      <section className="hiw-refusals" aria-labelledby="hiw-refusals-title">
        <div className="hiw-section-intro">
          <p className="hiw-kicker">Boundaries the system preserves</p>
          <h2 id="hiw-refusals-title">What Writ refuses to hide.</h2>
        </div>
        <ol>
          {[
            ["Missing evidence", "is not automatically false."],
            ["A mission statement", "is not automatically a legal mandate."],
            ["A model proposal", "is not automatically a reviewed fact."],
            ["A shared schema", "does not make two institutions equivalent."],
          ].map(([subject, boundary], index) => (
            <li key={subject}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>
                <strong>{subject}</strong> {boundary}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="hiw-details-and-close">
        <TechnicalFoundations />
        <div className="hiw-close">
          <p>Ready to inspect a real record?</p>
          <div>
            <Button
              nativeButton={false}
              render={
                <Link href="/lab">
                  Explore in Writ Lab <ArrowRight aria-hidden data-icon="inline-end" />
                </Link>
              }
            />
            <Link className="hiw-secondary-link" href="/">
              Return home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
