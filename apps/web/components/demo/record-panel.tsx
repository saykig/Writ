"use client";

/**
 * The third column: the record behind a citation.
 *
 * Closed until a citation or a listed record is opened, and closable again. On
 * a wide screen it is a column beside the memo, so the sentence and its source
 * are readable at once; on a narrow one it becomes a sheet over the page,
 * because a third column there would leave nothing for the memo.
 *
 * A record not yet traced to its source document says so rather than showing an
 * excerpt. That gap is the thing this panel exists to make visible.
 */

import * as React from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";

import type { MemoRecord } from "@/lib/demo-memo";
import { humanize } from "@/lib/policy-test-format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-[0.72rem] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right text-[0.78rem]",
          // `unknown` is a recorded judgment, not a blank, and reads as one.
          value === "unknown" ? "text-gold" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function RecordPanel({
  record,
  questionId,
  onClose,
}: {
  record: MemoRecord;
  questionId: string;
  onClose: () => void;
}) {
  // Keyed by record, so opening a different one collapses the raw view without
  // an effect that would re-render on every open.
  const [structuredFor, setStructuredFor] = React.useState<string | null>(null);
  const showStructured = structuredFor === record.claimId;

  return (
    <aside
      aria-label={`Source record ${record.claimId}`}
      className={cn(
        // Narrow screens: an overlay, because there is no room for a column.
        "fixed inset-x-0 bottom-0 z-40 max-h-[72vh] overflow-y-auto border-t border-border bg-background shadow-2xl",
        // Wide screens: the third column, following the reader down a long memo.
        "lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-20 lg:z-0 lg:h-fit",
        "lg:max-h-[calc(100dvh-6rem)] lg:rounded-lg lg:border lg:shadow-none",
      )}
    >
      <div>
        <header className="flex items-start justify-between gap-3 border-b border-border bg-background px-4 py-3 lg:px-5">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5">
              {record.n !== undefined ? (
                <span className="text-[0.9rem] font-medium tabular-nums">Note {record.n}</span>
              ) : (
                <span className="text-[0.9rem] font-medium">Record</span>
              )}
              <Badge variant="outline" className="font-mono text-[0.64rem]">
                {record.claimId}
              </Badge>
              <Badge variant="outline" className="text-[0.64rem]">
                {record.jurisdiction}
              </Badge>
            </p>
            <p className="mt-1 text-[0.74rem] leading-5 text-muted-foreground">
              {record.n !== undefined ? "This sentence is derived from " : "From "}
              record {record.claimId}, based on {record.instrument}, {record.sourceLocator}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source record"
            className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-5 px-4 py-4 lg:px-5">
          <section>
            <h3 className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
              Source excerpt
            </h3>
            {record.excerpt ? (
              <>
                <blockquote className="mt-2 border-l border-border pl-3 font-serif text-[0.84rem] leading-7">
                  “{record.excerpt}”
                </blockquote>
                {record.document ? (
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-muted-foreground">
                    <span>{record.document.title}</span>
                    {record.document.anchor ? <span>· {record.document.anchor}</span> : null}
                    <span>· retrieved {record.document.retrievedAt}</span>
                    <a
                      href={record.document.uri}
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
              <p className="mt-2 text-[0.78rem] leading-6 text-muted-foreground">
                This record has not yet been traced to its source document, so there is nothing to
                quote. The classification below is the reviewers’ and has not been checked against
                retrieved text.
              </p>
            )}
          </section>

          <section>
            <h3 className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
              Reviewed interpretation
            </h3>
            <p className="mt-2 font-serif text-[0.84rem] leading-7">{record.interpretation}</p>
          </section>

          <section>
            <h3 className="text-[0.66rem] tracking-[0.1em] uppercase text-muted-foreground">
              How Writ classified it
            </h3>
            <dl className="mt-2">
              <Row label="Legal force" value={humanize(record.legalForce)} />
              <Row label="Adoption" value={humanize(record.adoptionStatus)} />
              <Row label="Applicability" value={humanize(record.applicabilityStatus)} />
              <Row label="Enforcement" value={record.enforcementStatus} />
            </dl>
            {record.supportingFields.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
                <span>Cited for</span>
                {record.supportingFields.map((field) => (
                  <code
                    key={field}
                    className="rounded bg-muted px-1 py-0.5 font-mono text-[0.66rem] break-all text-foreground/80"
                  >
                    {field}
                  </code>
                ))}
              </div>
            ) : null}
          </section>

          <section>
            <button
              type="button"
              onClick={() => setStructuredFor(showStructured ? null : record.claimId)}
              aria-expanded={showStructured}
              className="text-[0.74rem] text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {showStructured ? "Hide structured record" : "View structured record"}
            </button>
            {showStructured ? (
              <dl className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                {record.structured.map((field) => (
                  <div
                    key={field.label}
                    className="flex items-baseline justify-between gap-3 py-1 font-mono text-[0.68rem]"
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
            className="inline-flex items-center gap-1.5 text-[0.76rem] underline decoration-border underline-offset-4 hover:text-foreground"
          >
            View this record in the Playground
            <ExternalLink aria-hidden className="size-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
