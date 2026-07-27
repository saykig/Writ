"use client";

import * as React from "react";
import { ChevronDown, ScanSearch } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HashPill } from "@/components/site/hash-pill";
import { formatReviewedDate, humanize, statusLabel } from "@/lib/policy-test-format";
import type { EvidenceEntry, PolicyTestView } from "@/components/policy-test/types";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Evidence IDs, each one a button back to the record it names. */
function EvidenceIds({
  ids,
  entriesById,
  onOpenEntry,
  label,
}: {
  ids: string[];
  entriesById: Map<string, EvidenceEntry>;
  onOpenEntry: (entry: EvidenceEntry, trigger: HTMLElement) => void;
  label: string;
}) {
  if (ids.length === 0) return null;
  return (
    <div>
      <h5 className="label">{label}</h5>
      <ul aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((id) => {
          const entry = entriesById.get(id);
          return (
            <li key={id}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Open reviewed record ${id}`}
                disabled={!entry}
                onClick={(event) => entry && onOpenEntry(entry, event.currentTarget)}
                className={cn(
                  "rounded-md border border-border px-2 py-1 font-mono text-[0.76rem] font-medium transition-colors duration-150 outline-none",
                  "hover:border-foreground/30 hover:bg-muted/50",
                  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                {id}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReceiptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-4">
      <dt className="label pt-0.5">{label}</dt>
      <dd className="min-w-0 text-[0.86rem] leading-6 break-words">{children}</dd>
    </div>
  );
}

export function PolicyTestReceipt({
  view,
  entriesById,
  onOpenEntry,
  onInspectEvidence,
}: {
  view: PolicyTestView;
  entriesById: Map<string, EvidenceEntry>;
  onOpenEntry: (entry: EvidenceEntry, trigger: HTMLElement) => void;
  onInspectEvidence: () => void;
}) {
  const [showFull, setShowFull] = React.useState(false);
  const { receipt, summary } = view;
  const from = formatReviewedDate(receipt.eu.transitionFrom);
  const until = formatReviewedDate(receipt.eu.transitionDeadline);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* European Union */}
        <section
          aria-label="European Union judgment"
          className="tool flex flex-col gap-4 p-5 sm:p-6"
        >
          <div>
            <h4 className="label">European Union</h4>
            <p className="mt-2 text-[1rem] leading-snug font-semibold text-primary text-balance">
              {statusLabel(receipt.eu.status)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 px-3.5 py-3">
            <h5 className="label">Defined class</h5>
            <p className="mt-1.5 text-[0.88rem] leading-6">{capitalize(receipt.eu.definedClass)}</p>
          </div>

          <p className="text-[0.88rem] leading-6 text-muted-foreground">
            EU-06 directly satisfies the headline rule because it creates a binding and currently
            applicable model-evaluation obligation for a defined class of market providers.
          </p>

          <EvidenceIds
            label="Decisive evidence"
            ids={receipt.eu.decisiveEvidence}
            entriesById={entriesById}
            onOpenEntry={onOpenEntry}
          />
          <EvidenceIds
            label="Supporting evidence"
            ids={receipt.eu.supportingEvidence}
            entriesById={entriesById}
            onOpenEntry={onOpenEntry}
          />

          <div className="mt-auto rounded-lg border border-border px-3.5 py-3">
            <h5 className="label">Qualification</h5>
            <p className="mt-1.5 text-[0.85rem] leading-6 text-muted-foreground">
              {until && from ? (
                <>
                  EU-11B preserves a transition period until {until} for qualifying models placed on
                  the market before {from}.
                </>
              ) : (
                receipt.eu.qualification
              )}
            </p>
          </div>
        </section>

        {/* United States */}
        <section
          aria-label="United States federal judgment"
          className="tool flex flex-col gap-4 p-5 sm:p-6"
        >
          <div>
            <h4 className="label">United States — federal</h4>
            <p className="mt-2 text-[1rem] leading-snug font-semibold text-balance">
              {statusLabel(receipt.us.status)}
            </p>
          </div>

          <p className="text-[0.88rem] leading-6 text-muted-foreground">
            The reviewed corpus contains voluntary evaluation guidance and binding government-use
            and procurement controls, but no current cross-sector model-evaluation obligation for
            private market providers.
          </p>

          <ul className="space-y-2.5">
            {receipt.us.subResults.map((result) => (
              <li
                key={result.key}
                className="rounded-lg border border-border bg-muted/25 px-3.5 py-3"
              >
                <h5 className="text-[0.85rem] font-semibold">{result.title}</h5>
                <p className="mt-1.5 text-[0.83rem] leading-6 text-muted-foreground">
                  {result.finding}
                </p>
                <div className="mt-2.5">
                  <EvidenceIds
                    label="Relevant evidence"
                    ids={result.evidence}
                    entriesById={entriesById}
                    onOpenEntry={onOpenEntry}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Receipt controls */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="lg"
          aria-expanded={showFull}
          aria-controls="policy-test-full-receipt"
          onClick={() => setShowFull((open) => !open)}
        >
          {showFull ? "Hide full receipt" : "View full receipt"}
          <ChevronDown
            aria-hidden
            className={cn("transition-transform duration-200", showFull && "rotate-180")}
          />
        </Button>
        <Button variant="outline" size="lg" onClick={onInspectEvidence}>
          <ScanSearch aria-hidden />
          Inspect reviewed evidence
        </Button>
      </div>

      <section
        id="policy-test-full-receipt"
        hidden={!showFull}
        aria-label="Full assessment receipt"
        className="tool mt-5 p-5 sm:p-6"
      >
        <dl className="divide-y divide-border">
          <ReceiptRow label="Dataset ID">
            <span className="font-mono text-[0.8rem]">{receipt.datasetId}</span>
          </ReceiptRow>
          <ReceiptRow label="Schema version">
            <span className="font-mono text-[0.8rem]">{receipt.schemaVersion}</span>
          </ReceiptRow>
          <ReceiptRow label="Review status">{humanize(receipt.reviewStatus)}</ReceiptRow>
          <ReceiptRow label="Pilot question">{receipt.pilotQuestion}</ReceiptRow>
          <ReceiptRow label="Methodology headline rule">
            <ul className="space-y-1">
              {view.ruleConditions.map((condition) => (
                <li key={condition.source}>
                  <span className="text-muted-foreground">{condition.label}: </span>
                  <span className="font-medium">{condition.value}</span>
                </li>
              ))}
            </ul>
          </ReceiptRow>
          <ReceiptRow label="European Union judgment">
            {statusLabel(receipt.eu.status)}
            <span className="block text-muted-foreground">
              {capitalize(receipt.eu.definedClass)}
            </span>
          </ReceiptRow>
          <ReceiptRow label="United States judgment">
            {statusLabel(receipt.us.status)}
            <ul className="mt-1.5 space-y-1 text-muted-foreground">
              {receipt.us.subResults.map((result) => (
                <li key={result.key}>
                  {result.title}: {result.evidence.join(", ")}
                </li>
              ))}
            </ul>
          </ReceiptRow>
          <ReceiptRow label="Decisive evidence">
            <span className="font-mono text-[0.8rem]">
              {receipt.eu.decisiveEvidence.join(", ")}
            </span>
          </ReceiptRow>
          <ReceiptRow label="Supporting evidence">
            <span className="font-mono text-[0.8rem]">
              {receipt.eu.supportingEvidence.join(", ")}
            </span>
          </ReceiptRow>
          <ReceiptRow label="Qualifications">{receipt.eu.qualification}</ReceiptRow>
          <ReceiptRow label="Reviewed source rows">
            <span className="tabular-nums">{summary.parentRowCount}</span>
          </ReceiptRow>
          <ReceiptRow label="Normalized claims">
            <span className="tabular-nums">{summary.normalizedClaimCount}</span>
          </ReceiptRow>
          <ReceiptRow label="Pending review">
            <span className="tabular-nums">{summary.pendingReviewCount}</span>
          </ReceiptRow>
          <ReceiptRow label="Rejected review">
            <span className="tabular-nums">{summary.rejectedReviewCount}</span>
          </ReceiptRow>
          <ReceiptRow label="Content hash">
            <HashPill hash={receipt.contentHash} chars={10} />
          </ReceiptRow>
        </dl>
        <p className="mt-4 text-[0.8rem] leading-6 text-muted-foreground">
          The hash is SHA-256 over the RFC 8785 canonical JSON of every field above, the same
          convention used by Writ evaluation receipts.
        </p>
      </section>
    </div>
  );
}
