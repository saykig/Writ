"use client";

/**
 * The answer, set as a document rather than as an interface.
 *
 * Serif text on a paper surface, a masthead, and a measured line length: a
 * reader should be able to treat this as something they could file, not as a
 * screen they have to operate.
 *
 * Five parts in a fixed order. The answer first, then the distinctions the
 * corpus keeps apart, then the evidence, then what is unknown, then what a
 * citation would have to name. The order is the argument: a finding that
 * arrives without its distinctions and its limits is not the same finding.
 *
 * Citations are sparse by design. Where one appears, it opens the record it
 * rests on; the evidence list covers everything the answer drew on.
 */

import * as React from "react";

import type { MemoSentence } from "@/lib/demo-memo";
import { agree, count, sentence } from "@/lib/demo-prose";
import type { QueryAnswer } from "@/lib/query-answer";
import { VersionMetadata } from "@/components/record/version-metadata";
import { cn } from "@/lib/utils";

function Citation({ notes, onOpen }: { notes: readonly number[]; onOpen: (n: number) => void }) {
  if (notes.length === 0) return null;
  return (
    <sup className="ml-[0.15em] inline-flex items-baseline gap-x-[0.3em]">
      {notes.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onOpen(n)}
          aria-label={`Open source note ${n}`}
          className="rounded-sm text-[0.62em] tabular-nums text-[var(--memo-accent)] transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {n}
        </button>
      ))}
    </sup>
  );
}

function Paragraph({
  sentences,
  onOpen,
  className,
}: {
  sentences: readonly MemoSentence[];
  onOpen: (n: number) => void;
  className?: string;
}) {
  return (
    <p className={cn("font-serif text-[1.02rem] leading-[1.85] text-foreground/90", className)}>
      {sentences.map((sentence, index) => (
        <React.Fragment key={index}>
          {index > 0 ? " " : null}
          {sentence.text}
          <Citation notes={sentence.notes} onOpen={onOpen} />
        </React.Fragment>
      ))}
    </p>
  );
}

function SectionHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[1.12rem] font-semibold tracking-[-0.01em]">
      <span className="mr-2 text-muted-foreground tabular-nums">{n}.</span>
      {children}
    </h2>
  );
}

export function AnswerDocument({
  answer,
  onOpenNote,
  onOpenRecord,
  activeClaimId,
}: {
  answer: QueryAnswer;
  onOpenNote: (n: number) => void;
  onOpenRecord: (claimId: string) => void;
  activeClaimId: string | null;
}) {
  const { uncertainty, versions } = answer;

  return (
    <article
      style={{ "--memo-accent": "oklch(0.62 0.14 25)" } as React.CSSProperties}
      className="rounded-lg border border-border bg-card/30 px-6 py-10 sm:px-12 sm:py-14 print:border-0 print:bg-transparent print:p-0"
    >
      <header className="border-b-2 border-foreground/20 pb-6">
        <p className="text-[0.62rem] tracking-[0.2em] uppercase text-muted-foreground">
          Answer from reviewed records · {answer.kind}
        </p>
        <h1 className="mt-4 font-serif text-[1.7rem] leading-[1.25] font-semibold tracking-[-0.01em] text-balance sm:text-[2.05rem]">
          {answer.title}
        </h1>
        <dl className="mt-6 space-y-1.5 border-t border-border/60 pt-4 text-[0.8rem]">
          <div className="flex gap-3">
            <dt className="w-[5.5rem] shrink-0 text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
              Question
            </dt>
            <dd className="font-serif leading-6">{answer.question}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-[5.5rem] shrink-0 text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
              Corpus
            </dt>
            <dd className="leading-6 text-muted-foreground">
              Reviewed EU–US AI evaluation pilot · {uncertainty.selected} reviewed claims ·{" "}
              {uncertainty.documents} source documents
            </dd>
          </div>
        </dl>
      </header>

      {/* 1 — the finding. */}
      <section className="mt-9">
        <SectionHeading n={1}>Answer</SectionHeading>
        <Paragraph
          sentences={answer.answer}
          onOpen={onOpenNote}
          className="mt-3 text-[1.06rem] leading-[1.8] text-foreground"
        />
      </section>

      {/* 2 — the conditions the answer holds under. */}
      <section className="mt-10">
        <SectionHeading n={2}>Important distinctions</SectionHeading>
        <p className="mt-1 text-[0.76rem] text-muted-foreground italic">
          Four dimensions the reviewed corpus records separately. Collapsing any of them changes the
          answer without any record having changed.
        </p>
        <div className="mt-5 space-y-7">
          {answer.distinctions.map((block) => (
            <div key={block.id}>
              <h3 className="text-[0.66rem] tracking-[0.16em] uppercase text-muted-foreground">
                {block.heading}
              </h3>
              <p className="mt-1 text-[0.76rem] text-muted-foreground italic">{block.purpose}</p>
              <div className="mt-2 space-y-4">
                {block.paragraphs.map((paragraph, index) => (
                  <Paragraph key={index} sentences={paragraph} onOpen={onOpenNote} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3 — every record the answer drew on, cited inline or not. */}
      <section className="mt-10 border-t border-border pt-7">
        <SectionHeading n={3}>Evidence used</SectionHeading>
        <p className="mt-2 text-[0.76rem] leading-6 text-muted-foreground">
          Drawn from {uncertainty.selected} of {uncertainty.corpus} reviewed claims. Select a record
          to open its exact source passage.
        </p>
        <ul className="mt-4 divide-y divide-border/50 border-y border-border/50">
          {answer.evidence.map((record) => (
            <li key={record.claimId}>
              <button
                type="button"
                onClick={() => onOpenRecord(record.claimId)}
                className={cn(
                  "flex w-full items-baseline gap-3 py-2 text-left transition-colors",
                  "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  activeClaimId === record.claimId && "bg-muted/50",
                )}
              >
                <span className="w-7 shrink-0 text-right text-[0.7rem] tabular-nums text-[var(--memo-accent)]">
                  {record.n ?? ""}
                </span>
                <span className="w-[4.5rem] shrink-0 font-mono text-[0.68rem] text-muted-foreground">
                  {record.claimId}
                </span>
                <span className="min-w-0 flex-1 text-[0.78rem] leading-6">
                  {record.instrument}, {record.sourceLocator}
                  {record.excerpt ? null : (
                    <span className="text-muted-foreground"> · not yet traced</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 — what the reviewed record does not settle. */}
      <section className="mt-10 border-t border-border pt-7">
        <SectionHeading n={4}>Uncertainty and limits</SectionHeading>
        <div className="mt-3 space-y-3 text-[0.86rem] leading-7 text-foreground/90">
          {uncertainty.unknownEnforcement.length > 0 ? (
            <p>
              Enforcement is recorded as <span className="text-unknown">unknown</span> for{" "}
              {count(uncertainty.unknownEnforcement.length, "record", "records")} drawn on. That is
              a judgment about the evidence, not a finding that the measure is unenforceable, and it
              is left as it was recorded:{" "}
              <span className="font-mono text-[0.74rem]">
                {uncertainty.unknownEnforcement.join(", ")}
              </span>
              .
            </p>
          ) : (
            <p>No record drawn on here leaves its enforcement status unknown.</p>
          )}
          {uncertainty.untraced.length > 0 ? (
            <p>
              {sentence(count(uncertainty.untraced.length, "record", "records"))} drawn on{" "}
              {agree(uncertainty.untraced.length, "is", "are")} not yet traced to a source document
              and {agree(uncertainty.untraced.length, "carries", "carry")} no excerpt:{" "}
              <span className="font-mono text-[0.74rem]">{uncertainty.untraced.join(", ")}</span>.
              The classification there is the reviewers’ and has not been checked against retrieved
              text.
            </p>
          ) : null}
          <p>
            This answer covers {uncertainty.selected} of {uncertainty.corpus} reviewed claims in the
            pilot, and nothing outside it. Writ answers from the corpus named above, not from AI
            governance at large.
          </p>
        </div>
      </section>

      {/* 5 — what a citation would have to name. */}
      <section className="mt-10 border-t border-border pt-7">
        <SectionHeading n={5}>Corpus and query versions</SectionHeading>
        <div className="mt-4">
          <VersionMetadata
            entries={[
              { label: "Dataset", value: versions.datasetId, mono: true },
              { label: "Schema", value: versions.schemaVersion, mono: true },
              { label: "Review status", value: versions.reviewStatus },
              { label: "Interpretation profile", value: versions.profileId, mono: true },
              { label: "Question", value: answer.questionId, mono: true },
              { label: "Reviewed source", value: versions.datasetSource, mono: true },
              { label: "EU corpus", value: versions.corpusPaths.EU, mono: true },
              { label: "US corpus", value: versions.corpusPaths.US, mono: true },
            ]}
            hashes={[{ label: "answer", hash: versions.receiptHash }]}
          />
        </div>
      </section>

      <footer className="mt-9 border-t border-border pt-6">
        <p className="text-[0.72rem] text-muted-foreground italic">written in Writ.</p>
      </footer>
    </article>
  );
}
