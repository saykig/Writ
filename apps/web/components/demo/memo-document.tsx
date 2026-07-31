"use client";

/**
 * The memo, set as a document rather than as an interface.
 *
 * Serif text on a paper surface, a masthead, numbered sections and a measured
 * line length. The point is that a reader should be able to treat this as a
 * memorandum they could file, not as a screen they have to operate — the same
 * reviewed records the Writ Lab compiles, rendered for reading.
 *
 * Citations are sparse by design. Where one appears, it opens the record it
 * rests on; the record list at the end covers everything the memo drew on.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { Memo, MemoSentence } from "@/lib/demo-memo";
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

export function MemoDocument({
  memo,
  onOpenNote,
  onOpenRecord,
  activeClaimId,
}: {
  memo: Memo;
  onOpenNote: (n: number) => void;
  onOpenRecord: (claimId: string) => void;
  activeClaimId: string | null;
}) {
  return (
    <article
      style={{ "--memo-accent": "oklch(0.62 0.14 25)" } as React.CSSProperties}
      className="rounded-lg border border-border bg-card/30 px-6 py-10 sm:px-12 sm:py-14 print:border-0 print:bg-transparent print:p-0"
    >
      {/* Masthead */}
      <header className="border-b-2 border-foreground/20 pb-6">
        <p className="text-[0.62rem] tracking-[0.2em] uppercase text-muted-foreground">
          Policy memorandum · {memo.kind}
        </p>
        <h1 className="mt-4 font-serif text-[1.7rem] leading-[1.25] font-semibold tracking-[-0.01em] text-balance sm:text-[2.05rem]">
          {memo.title}
        </h1>
        <dl className="mt-6 space-y-1.5 border-t border-border/60 pt-4 text-[0.8rem]">
          <div className="flex gap-3">
            <dt className="w-[5.5rem] shrink-0 text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
              Question
            </dt>
            <dd className="font-serif leading-6">{memo.question}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-[5.5rem] shrink-0 text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
              Source
            </dt>
            <dd className="leading-6 text-muted-foreground">
              {memo.coverage.selected} reviewed claims · {memo.coverage.documents} source documents
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-[5.5rem] shrink-0 text-[0.66rem] tracking-[0.12em] uppercase text-muted-foreground">
              Profile
            </dt>
            <dd className="font-mono text-[0.72rem] leading-6 text-muted-foreground">
              {memo.profileId}
            </dd>
          </div>
        </dl>
      </header>

      <section className="mt-9">
        <h2 className="text-[0.66rem] tracking-[0.16em] uppercase text-muted-foreground">
          Executive finding
        </h2>
        <Paragraph
          sentences={memo.executive}
          onOpen={onOpenNote}
          className="mt-3 text-[1.06rem] leading-[1.8] text-foreground"
        />
      </section>

      {memo.sections.map((section, index) => (
        <section key={section.id} className="mt-10">
          <h2 className="font-serif text-[1.12rem] font-semibold tracking-[-0.01em]">
            <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
            {section.heading}
          </h2>
          <p className="mt-1 text-[0.76rem] text-muted-foreground italic">{section.purpose}</p>
          <div className="mt-3 space-y-4">
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <Paragraph key={paragraphIndex} sentences={paragraph} onOpen={onOpenNote} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10 border-t border-border pt-7">
        <h2 className="font-serif text-[1.12rem] font-semibold tracking-[-0.01em]">Conclusion</h2>
        <Paragraph sentences={memo.conclusion} onOpen={onOpenNote} className="mt-3" />
      </section>

      {/* Everything the memo drew on, cited inline or not. */}
      <section className="mt-10 border-t border-border pt-7">
        <h2 className="text-[0.66rem] tracking-[0.16em] uppercase text-muted-foreground">
          Records considered
        </h2>
        <p className="mt-2 text-[0.76rem] leading-6 text-muted-foreground">
          Drawn from {memo.coverage.selected} of {memo.coverage.corpus} reviewed claims.
          {memo.coverage.untraced.length > 0 ? (
            <>
              {" "}
              {memo.coverage.untraced.length} are not yet traced to a source document and carry no
              excerpt.
            </>
          ) : null}
        </p>
        <ul className="mt-4 divide-y divide-border/50 border-y border-border/50">
          {memo.records.map((record) => (
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

      <footer className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-[0.72rem] text-muted-foreground italic">written in Writ.</p>
        <Link
          href={{ pathname: "/lab", query: { example: "reviewed", from: memo.questionId } }}
          className="inline-flex items-center gap-1 text-[0.76rem] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground print:hidden"
        >
          Trace this judgment in Writ Lab
          <ArrowUpRight aria-hidden className="size-3" />
        </Link>
      </footer>
    </article>
  );
}
