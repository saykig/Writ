"use client";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EvidenceEntry } from "@/components/policy-test/types";

/**
 * The reviewed record behind one evidence ID, shown verbatim.
 *
 * Two absences are deliberately not the same thing, and the panel keeps them
 * apart: `unknown` is a judgment the reviewers recorded and is rendered in the
 * reserved unknown colour, while a field the reviewers left off reads "Not
 * recorded". Neither is filled in with a guess.
 */
export function PolicyEvidenceDetail({
  entry,
  onClose,
}: {
  entry: EvidenceEntry | null;
  onClose: () => void;
}) {
  const hasUnknown = entry?.fields.some((field) => field.tone === "unknown") ?? false;

  return (
    <Sheet open={entry !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        aria-label={entry ? `Reviewed record ${entry.id}` : "Reviewed record"}
        className="w-full gap-0 overflow-y-auto sm:max-w-lg"
      >
        {entry ? (
          <>
            <SheetHeader className="gap-2 border-b border-border">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label-mono rounded-md border border-border px-1.5 py-0.5 font-mono text-foreground">
                  {entry.id}
                </span>
                <span className="label">
                  {entry.kind === "derived_claim"
                    ? `Derived claim of ${entry.parentRowId}`
                    : "Reviewed source row"}
                </span>
              </div>
              <SheetTitle className="text-[length:var(--t-h3)] leading-snug">
                {entry.summary}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Every reviewed field recorded for {entry.id}.
              </SheetDescription>
            </SheetHeader>

            <dl className="divide-y divide-border px-4 pb-4">
              {entry.fields.map((field) => (
                <div
                  key={field.label}
                  className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="label pt-0.5">{field.label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 text-[0.88rem] leading-6 break-words",
                      field.value === null && "text-muted-foreground/70",
                      field.tone === "unknown" && "font-medium text-unknown",
                      field.tone === "mono" && "font-mono text-[0.82rem]",
                    )}
                  >
                    {field.value ?? "Not recorded"}
                  </dd>
                </div>
              ))}
            </dl>

            {hasUnknown ? (
              <p className="mx-4 mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-[0.8rem] leading-6 text-muted-foreground">
                <span className="font-medium text-unknown">unknown</span> is a judgment the
                reviewers recorded, not a missing value. It is never resolved into something more
                definite.
              </p>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
