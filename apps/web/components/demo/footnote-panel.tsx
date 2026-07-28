"use client";

/**
 * What a footnote opens.
 *
 * This is where the Demo earns its claim: a sentence in the memo is shown to
 * rest on a named record, a named provision, and the document's own words. The
 * plain-language explanation comes first; the structured record sits behind a
 * control for anyone who wants it.
 *
 * A record that has not been traced to its source document says so instead of
 * showing an excerpt, because an untraced classification is exactly the thing
 * this panel exists to make visible.
 */

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { MemoFootnote } from "@/lib/demo-memo";
import { humanize } from "@/lib/policy-test-format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-[0.72rem] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-[0.8rem]",
          // `unknown` is a recorded judgment, not a missing value, and reads in
          // its own colour so it is not mistaken for a blank.
          value === "unknown" ? "text-gold" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function FootnotePanel({
  note,
  questionId,
  onOpenChange,
}: {
  note: MemoFootnote | null;
  questionId: string;
  onOpenChange: (open: boolean) => void;
}) {
  // Which note has its raw record expanded. Storing the note rather than a
  // boolean means opening a different footnote collapses it without an effect.
  const [structuredFor, setStructuredFor] = React.useState<number | null>(null);
  const showStructured = note !== null && structuredFor === note.n;

  return (
    <Sheet open={note !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[30rem]">
        {note ? (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle className="flex flex-wrap items-center gap-2 text-[0.95rem]">
                <span className="tabular-nums">Note {note.n}</span>
                <Badge variant="outline" className="font-mono text-[0.66rem]">
                  {note.claimId}
                </Badge>
                <Badge variant="outline" className="text-[0.66rem]">
                  {note.jurisdiction}
                </Badge>
              </SheetTitle>
              <SheetDescription className="text-[0.8rem]">
                This sentence is derived from record {note.claimId}, based on {note.instrument},{" "}
                {note.sourceLocator}.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 p-4">
              {/* The document's own words. */}
              <section>
                <h3 className="text-[0.7rem] tracking-[0.1em] uppercase text-muted-foreground">
                  Source excerpt
                </h3>
                {note.excerpt ? (
                  <>
                    <blockquote className="mt-2 border-l border-border pl-3 text-[0.85rem] leading-7">
                      “{note.excerpt}”
                    </blockquote>
                    {note.document ? (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted-foreground">
                        <span>{note.document.title}</span>
                        {note.document.anchor ? <span>· {note.document.anchor}</span> : null}
                        <span>· retrieved {note.document.retrievedAt}</span>
                        <a
                          href={note.document.uri}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:text-foreground"
                        >
                          open
                          <ExternalLink aria-hidden className="size-2.5" />
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-[0.82rem] leading-6 text-muted-foreground">
                    This record has not yet been traced to its source document, so there is nothing
                    to quote. The classification below is the reviewers’ and has not been checked
                    against retrieved text.
                  </p>
                )}
              </section>

              {/* What the reviewers made of it. */}
              <section>
                <h3 className="text-[0.7rem] tracking-[0.1em] uppercase text-muted-foreground">
                  Reviewed interpretation
                </h3>
                <p className="mt-2 text-[0.85rem] leading-7">{note.interpretation}</p>
              </section>

              <section>
                <h3 className="text-[0.7rem] tracking-[0.1em] uppercase text-muted-foreground">
                  How Writ classified it
                </h3>
                <dl className="mt-2">
                  <Row label="Legal force" value={humanize(note.legalForce)} />
                  <Row label="Adoption" value={humanize(note.adoptionStatus)} />
                  <Row label="Applicability" value={humanize(note.applicabilityStatus)} />
                  <Row label="Enforcement" value={note.enforcementStatus} />
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.72rem] leading-5 text-muted-foreground">
                  <span>Cited in this memo for</span>
                  {note.supportingFields.map((field) => (
                    <code
                      key={field}
                      className="rounded bg-muted px-1 py-0.5 font-mono text-[0.68rem] break-all text-foreground/80"
                    >
                      {field}
                    </code>
                  ))}
                </div>
              </section>

              {/* The raw record, only for those who ask for it. */}
              <section>
                <button
                  type="button"
                  onClick={() => setStructuredFor(showStructured ? null : (note?.n ?? null))}
                  aria-expanded={showStructured}
                  className="text-[0.76rem] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {showStructured ? "Hide structured record" : "View structured record"}
                </button>
                {showStructured ? (
                  <dl className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                    {note.structured.map((field) => (
                      <div
                        key={field.label}
                        className="flex items-baseline justify-between gap-4 py-1 font-mono text-[0.7rem]"
                      >
                        <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
                        <dd
                          className={cn(
                            "text-right break-all",
                            field.value === null
                              ? "text-muted-foreground/50"
                              : field.value === "unknown"
                                ? "text-gold"
                                : "text-foreground",
                          )}
                        >
                          {field.value ?? "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>

              <Link
                href={{ pathname: "/playground", query: { example: "reviewed", from: questionId } }}
                className="inline-flex items-center gap-1.5 text-[0.8rem] underline decoration-border underline-offset-4 hover:text-foreground"
              >
                View this record in the Playground
                <ExternalLink aria-hidden className="size-3" />
              </Link>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
