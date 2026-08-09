/**
 * The document's own words, and where they came from.
 *
 * Shared by record-reading surfaces so a passage reads the same wherever it is
 * met. Three states, and the third is the reason
 * this is a component rather than a blockquote:
 *
 *   - direct — the passage was recorded against this record;
 *   - inherited — it was recorded against the bundle this record belongs to,
 *     which the reader is told rather than left to assume;
 *   - unresolved — no source document is registered, so there is nothing to
 *     quote. The registry's own reason is shown in place of an excerpt, never a
 *     paraphrase and never a blank.
 *
 * `highlight` marks the span a selected field is grounded in. A field grounded
 * outside the retrieved span passes `null`, and nothing lights up.
 */

import { ExternalLink } from "lucide-react";

import type { LabRecordSource } from "@/lib/record-view";
import { formatReviewedDate } from "@/lib/demo-analysis-format";
import { cn } from "@/lib/utils";

function Quote({
  quote,
  highlight,
}: {
  quote: string;
  highlight: { start: number; end: number } | null;
}) {
  if (!highlight) return <>{quote}</>;
  const { start, end } = highlight;
  return (
    <>
      {quote.slice(0, start)}
      <mark className="rounded-[2px] bg-gold-wash px-0.5 text-foreground ring-1 ring-gold/40 transition-colors motion-reduce:transition-none">
        {quote.slice(start, end)}
      </mark>
      {quote.slice(end)}
    </>
  );
}

export function SourcePassage({
  source,
  highlight = null,
  className,
}: {
  source: LabRecordSource;
  highlight?: { start: number; end: number } | null;
  className?: string;
}) {
  const { document } = source;

  if (source.state === "unresolved" || !source.quote) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-[0.82rem] leading-7 text-muted-foreground">
          No source document is registered for this instrument, so there is no passage to quote. The
          classification below is the reviewers’ and has not been checked against retrieved text.
        </p>
        {source.unresolvedReason ? (
          <p className="border-l border-border pl-3 font-mono text-[0.7rem] leading-6 text-muted-foreground">
            {source.unresolvedReason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <blockquote className="border-l border-border pl-4 font-serif text-[0.95rem] leading-8 text-foreground">
        “<Quote quote={source.quote} highlight={highlight} />”
      </blockquote>

      {document ? (
        <div className="space-y-1 text-[0.72rem] leading-6 text-muted-foreground">
          <p className="text-foreground/80">{document.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{document.publisher}</span>
            {document.issuedAt ? (
              <span>· issued {formatReviewedDate(document.issuedAt.slice(0, 10))}</span>
            ) : null}
            {source.locator ? <span>· {source.locator}</span> : null}
            {document.retrievedAt ? (
              <span>· retrieved {document.retrievedAt.slice(0, 10)}</span>
            ) : null}
            {document.uri ? (
              <a
                href={document.uri}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:text-foreground"
              >
                open source
                <ExternalLink aria-hidden className="size-2.5" />
              </a>
            ) : null}
          </p>
        </div>
      ) : null}

      {source.state === "inherited" && source.passageRowId ? (
        <p className="text-[0.72rem] leading-6 text-muted-foreground">
          This passage was recorded against {source.passageRowId}, the bundle this record was
          derived from.
        </p>
      ) : null}
    </div>
  );
}
