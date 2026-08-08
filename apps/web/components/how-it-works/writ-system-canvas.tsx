"use client";

import { useState } from "react";
import { motion } from "motion/react";

import type { StoryStage } from "@/components/how-it-works/story-types";
import { cn } from "@/lib/utils";

type TraceTarget = "result" | "record" | "review" | "passage" | "source";

const STAGE_ORDER: Readonly<Record<StoryStage, number>> = {
  source: 0,
  passage: 1,
  record: 2,
  review: 3,
  corpus: 4,
  query: 5,
  result: 6,
};

const TRACE_ITEMS: readonly { id: TraceTarget; label: string }[] = [
  { id: "result", label: "Result" },
  { id: "record", label: "Record" },
  { id: "review", label: "Human judgment" },
  { id: "passage", label: "Passage" },
  { id: "source", label: "Source" },
];

function present(stage: StoryStage, from: StoryStage): boolean {
  return STAGE_ORDER[stage] >= STAGE_ORDER[from];
}

export function WritSystemCanvas({
  activeStage,
  compact = false,
}: {
  activeStage: StoryStage;
  compact?: boolean;
}) {
  const [traceTarget, setTraceTarget] = useState<TraceTarget | null>(null);
  const hasPassage = present(activeStage, "passage");
  const hasRecord = present(activeStage, "record");
  const hasReview = present(activeStage, "review");
  const hasCorpus = present(activeStage, "corpus");
  const hasQuery = present(activeStage, "query");
  const hasResult = present(activeStage, "result");
  const transition = { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      className={cn("hiw-canvas", compact && "hiw-canvas--compact")}
      data-stage={activeStage}
      data-trace={traceTarget ?? "none"}
    >
      <div className="hiw-canvas-topline">
        <span>Writ object trace</span>
        <span>{String(STAGE_ORDER[activeStage] + 1).padStart(2, "0")} / 07</span>
      </div>

      <motion.article
        className="hiw-source-object"
        data-trace-object="source"
        animate={{
          opacity: hasResult || traceTarget === "source" ? 1 : hasCorpus ? 0.24 : 1,
          scale: hasRecord ? 0.82 : 1,
          x: hasRecord ? -76 : 0,
          y: hasCorpus ? -42 : 0,
        }}
        transition={transition}
      >
        <header>
          <span>OFFICIAL WEBPAGE</span>
          {compact ? (
            <span>nist.gov</span>
          ) : (
            <a href="https://www.nist.gov/about-nist" target="_blank" rel="noreferrer noopener">
              nist.gov ↗
            </a>
          )}
        </header>
        <div className="hiw-source-title">
          <span className="hiw-nist-mark" aria-hidden>
            N
          </span>
          <div>
            <strong>About NIST</strong>
            <small>Updated January 11, 2022</small>
          </div>
        </div>
        <div className="hiw-source-copy">
          <span className="hiw-source-line" />
          <p data-trace-object="passage" className={hasPassage ? "is-selected" : undefined}>
            The National Institute of Standards and Technology (NIST) was founded in 1901 and is now
            part of the U.S. Department of Commerce.
          </p>
          <span className="hiw-source-line hiw-source-line--short" />
          <span className="hiw-source-line" />
        </div>
        <footer>
          <span>nist.about.v2022_01_11</span>
          <span>document stored</span>
        </footer>
      </motion.article>

      <motion.div
        className="hiw-passage-object"
        data-trace-object="passage"
        aria-hidden={!hasPassage}
        animate={{
          opacity: hasPassage && !hasCorpus ? 1 : traceTarget === "passage" ? 1 : 0,
          x: hasRecord ? 58 : 0,
          y: hasRecord ? -72 : 28,
          scale: hasRecord ? 0.76 : 1,
        }}
        transition={transition}
      >
        <span>EXACT PASSAGE · DIRECT EVIDENCE</span>
        <p>
          “The National Institute of Standards and Technology (NIST) was founded in 1901 and is now
          part of the U.S. Department of Commerce.”
        </p>
        <small>About NIST, opening paragraph</small>
      </motion.div>

      <motion.article
        className="hiw-record-object"
        data-trace-object="record"
        aria-hidden={!hasRecord}
        animate={{
          opacity: hasRecord ? (hasCorpus && !hasQuery && traceTarget !== "record" ? 0.68 : 1) : 0,
          scale: hasCorpus ? 0.72 : 1,
          x: hasCorpus ? 74 : 72,
          y: hasCorpus ? 90 : 82,
        }}
        transition={transition}
      >
        <header>
          <span>PLACEMENT</span>
          <span>{hasReview ? "APPROVED" : "PROPOSED RECORD"}</span>
        </header>
        <div className="hiw-placement">
          <strong>NIST</strong>
          <span aria-hidden>↓</span>
          <strong>U.S. Department of Commerce</strong>
        </div>
        <dl>
          <div>
            <dt>family</dt>
            <dd>institutional</dd>
          </div>
          <div>
            <dt>evidence</dt>
            <dd>direct</dd>
          </div>
          <div>
            <dt>fact type</dt>
            <dd>placement</dd>
          </div>
        </dl>
      </motion.article>

      <motion.div
        className="hiw-fact-types"
        aria-hidden={!hasRecord || hasReview}
        animate={{ opacity: hasRecord && !hasReview ? 1 : 0 }}
        transition={transition}
      >
        {["IDENTITY", "MISSION", "MANDATE", "FUNCTION", "DECISION RIGHT", "CAPACITY"].map(
          (fact) => (
            <span key={fact}>{fact}</span>
          ),
        )}
      </motion.div>

      <motion.section
        className="hiw-review-object"
        data-trace-object="review"
        aria-hidden={!hasReview}
        animate={{ opacity: hasReview && !hasCorpus ? 1 : traceTarget === "review" ? 1 : 0 }}
        transition={transition}
      >
        <header>
          <span>HUMAN REVIEW</span>
          <span>judgment accepted</span>
        </header>
        <dl>
          <div>
            <dt>evidence</dt>
            <dd>direct</dd>
          </div>
          <div>
            <dt>fact type</dt>
            <dd>placement</dd>
          </div>
          <div>
            <dt>boundary</dt>
            <dd>no decision-right claim</dd>
          </div>
        </dl>
        <div className="hiw-review-actions">
          <span className="is-decided">approve</span>
          <span>revise</span>
          <span>reject</span>
        </div>
        <p>
          created <i /> reviewed <i /> <strong>approved</strong>
        </p>
      </motion.section>

      <motion.section
        className="hiw-corpus-object"
        aria-hidden={!hasCorpus}
        animate={{ opacity: hasCorpus ? 1 : 0, y: hasCorpus ? 0 : 30 }}
        transition={transition}
      >
        <div className="hiw-corpus-lane hiw-corpus-lane--legal">
          <span>legal_policy</span>
          <i />
          <i />
          <i />
          <small>issuer + instrument</small>
        </div>
        <div className="hiw-corpus-lane hiw-corpus-lane--institutional">
          <span>institutional</span>
          <strong>NIST institutional corpus</strong>
          <div>
            <i />
            <i className="is-record" />
            <i />
          </div>
          <small>root institution</small>
        </div>
      </motion.section>

      <motion.div
        className="hiw-query-object"
        aria-hidden={!hasQuery}
        animate={{ opacity: hasQuery ? 1 : 0, y: hasQuery ? 0 : -18 }}
        transition={transition}
      >
        <span>QUERY</span>
        <p>Where is NIST organizationally situated?</p>
        <i aria-hidden />
      </motion.div>

      <motion.div
        className="hiw-result-object"
        data-trace-object="result"
        aria-hidden={!hasResult}
        animate={{ opacity: hasResult ? 1 : 0, y: hasResult ? 0 : 22 }}
        transition={transition}
      >
        <span>RESULT</span>
        <p>NIST is organizationally situated within the U.S. Department of Commerce.</p>
        <small>supported by 1 approved record</small>
      </motion.div>

      <motion.div
        className="hiw-trace-object"
        aria-hidden={!hasResult}
        animate={{ opacity: hasResult ? 1 : 0 }}
        transition={transition}
      >
        {TRACE_ITEMS.map((item, index) => {
          const contents = (
            <>
              <span>{item.label}</span>
              {index < TRACE_ITEMS.length - 1 ? <i aria-hidden /> : null}
            </>
          );

          return compact ? (
            <span key={item.id}>{contents}</span>
          ) : (
            <button
              key={item.id}
              type="button"
              onPointerEnter={() => setTraceTarget(item.id)}
              onPointerLeave={() => setTraceTarget(null)}
              onFocus={() => setTraceTarget(item.id)}
              onBlur={() => setTraceTarget(null)}
            >
              {contents}
            </button>
          );
        })}
      </motion.div>

      <p className="hiw-canvas-caption">
        Reviewed NIST Stage A example · source, record and judgment preserved separately
      </p>
    </div>
  );
}
