"use client";

/**
 * The memo itself.
 *
 * Reads as a policy memorandum: a question, a finding, four analytical sections
 * and a conclusion. No coded field names appear in the prose. The citations are
 * the way in — every one opens the record it rests on, so a reader who wants to
 * check a sentence can, and a reader who does not is never shown a field name.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import type { Memo, MemoFootnote, MemoSentence } from "@/lib/demo-memo";
import type { RepoProvenance } from "@/lib/repo-provenance";
import { citationRun } from "@/lib/demo-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DownloadMenu } from "./download-menu";
import { FootnotePanel } from "./footnote-panel";

function Citation({ notes, onOpen }: { notes: readonly number[]; onOpen: (n: number) => void }) {
  if (notes.length === 0) return null;
  // Every number stays its own control, because a citation is only useful if it
  // opens the record it points at. They are set tight rather than
  // comma-separated so a sentence resting on a dozen records still reads.
  return (
    <sup className="ml-0.5 inline-flex flex-wrap items-baseline gap-x-[0.25em] align-super">
      {notes.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onOpen(n)}
          aria-label={`Open source note ${n}`}
          className="rounded-sm text-[0.7em] tabular-nums text-[var(--demo-accent)] underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
    <p className={cn("text-[0.92rem] leading-8", className)}>
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

export function MemoView({
  memo,
  provenance,
  profileSource,
  profileFilename,
}: {
  memo: Memo;
  provenance: RepoProvenance;
  profileSource: string;
  profileFilename: string;
}) {
  const [openNote, setOpenNote] = React.useState<MemoFootnote | null>(null);
  const open = React.useCallback(
    (n: number) => setOpenNote(memo.footnotes.find((note) => note.n === n) ?? null),
    [memo.footnotes],
  );

  return (
    <main
      style={{ "--demo-accent": "oklch(0.68 0.15 25)" } as React.CSSProperties}
      className="mx-auto w-full max-w-[46rem] px-5 py-10 sm:px-6 sm:py-14"
    >
      {/* Back to the three questions, and the exports. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={
            <Link href="/demo">
              <ArrowLeft />
              All questions
            </Link>
          }
        />
        <DownloadMenu
          memo={memo}
          provenance={provenance}
          profileSource={profileSource}
          profileFilename={profileFilename}
        />
      </div>

      <article className="mt-8">
        <header className="border-b border-border pb-7">
          <Badge variant="outline" className="text-[0.64rem] tracking-[0.12em] uppercase">
            {memo.kind}
          </Badge>
          <h1 className="mt-4 text-[1.6rem] leading-[1.3] font-semibold tracking-[-0.02em] text-balance sm:text-[1.9rem]">
            {memo.title}
          </h1>
          <p className="mt-4 text-[0.88rem] leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">Question. </span>
            {memo.question}
          </p>
          <p className="mt-4 text-[0.72rem] text-muted-foreground/80 italic">written in Writ.</p>
        </header>

        <section className="mt-8">
          <h2 className="text-[0.7rem] tracking-[0.12em] uppercase text-muted-foreground">
            Executive finding
          </h2>
          <Paragraph
            sentences={memo.executive}
            onOpen={open}
            className="mt-3 text-[0.98rem] leading-8"
          />
        </section>

        {memo.sections.map((section) => (
          <section key={section.id} className="mt-10">
            <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em]">{section.heading}</h2>
            <p className="mt-1 text-[0.78rem] text-muted-foreground">{section.purpose}</p>
            <div className="mt-3 space-y-4">
              {section.paragraphs.map((paragraph, index) => (
                <Paragraph key={index} sentences={paragraph} onOpen={open} />
              ))}
            </div>
          </section>
        ))}

        <section className="mt-10 border-t border-border pt-7">
          <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em]">Conclusion</h2>
          <div className="mt-3 space-y-4">
            <Paragraph sentences={memo.conclusion} onOpen={open} />
          </div>
        </section>

        {/* Sources, in full. On screen these are the targets of the citations
            above; in a print view they are the memo's own reference list. */}
        <section className="mt-10 border-t border-border pt-7">
          <h2 className="text-[1.02rem] font-semibold tracking-[-0.01em]">Sources</h2>
          <ol className="mt-4 space-y-3">
            {memo.footnotes.map((note) => (
              <li
                key={note.n}
                id={`note-${note.n}`}
                className="grid grid-cols-[1.6rem_minmax(0,1fr)] gap-x-2 text-[0.78rem] leading-6"
              >
                <span className="tabular-nums text-muted-foreground">{note.n}.</span>
                <span>
                  <button
                    type="button"
                    onClick={() => open(note.n)}
                    className="text-left underline decoration-border underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="font-mono text-[0.72rem]">{note.claimId}</span> ·{" "}
                    {note.instrument}, {note.sourceLocator}
                  </button>
                  {note.excerpt ? (
                    <span className="text-muted-foreground">
                      {" "}
                      — “{note.excerpt.slice(0, 130)}
                      {note.excerpt.length > 130 ? "…" : ""}”
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {" "}
                      — not yet traced to a source document
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-5 text-[0.76rem] leading-6 text-muted-foreground">
            Drawn from {memo.coverage.selected} of {memo.coverage.corpus} reviewed claims across{" "}
            {memo.coverage.documents} source documents.
            {memo.coverage.untraced.length > 0 ? (
              <>
                {" "}
                {memo.coverage.untraced.length} of the selected claims are not yet traced to a
                source document ({memo.coverage.untraced.join(", ")}), and are cited without an
                excerpt.
              </>
            ) : null}
          </p>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7 print:hidden">
          <p className="text-[0.76rem] text-muted-foreground">
            Profile <code className="font-mono text-[0.72rem]">{memo.profileId}</code>
          </p>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={{
                  pathname: "/playground",
                  query: { example: "reviewed", from: memo.questionId },
                }}
              >
                View how this was structured in the Playground
                <ArrowUpRight />
              </Link>
            }
          />
        </footer>
      </article>

      <FootnotePanel
        note={openNote}
        questionId={memo.questionId}
        onOpenChange={(next) => {
          if (!next) setOpenNote(null);
        }}
      />
    </main>
  );
}

export { citationRun };
