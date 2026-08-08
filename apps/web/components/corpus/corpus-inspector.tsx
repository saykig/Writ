"use client";

import Link from "next/link";
import { ExternalLink, LoaderCircle, X } from "lucide-react";

import type { CorpusRecordDetail } from "@/lib/corpus-record-types";
import { humanizeCorpusValue } from "@/lib/corpus-browser-model";
import { cn } from "@/lib/utils";

type InspectorState = "idle" | "loading" | "ready" | "not_found" | "error";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[0.66rem] font-medium tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-4 border-b border-border/60 py-2.5 last:border-b-0">
      <dt className="text-[0.74rem] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-[0.8rem] leading-5 break-words",
          value === "Unknown" && "text-unknown",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((item) => readableValue(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return humanizeCorpusValue(String(value));
}

function institutionalRows(detail: CorpusRecordDetail): readonly [string, string][] {
  const fields = detail.recordedFields;
  const rows: [string, string][] = [];
  const add = (key: string, label: string) => {
    if (fields[key] !== undefined) rows.push([label, readableValue(fields[key])]);
  };
  add("institutional_fact_type", "Fact type");
  add("institution_id", "Institution");
  add("institution_type", "Institution type");
  add("parent_institution_id", "Parent institution");
  add("function", "Function");

  for (const [containerKey, prefix] of [
    ["mission", "Mission"],
    ["mandate", "Mandate"],
    ["decision_right", "Decision right"],
    ["operational_capacity", "Capacity"],
  ] as const) {
    const container = fields[containerKey];
    if (!container || typeof container !== "object" || Array.isArray(container)) continue;
    for (const [key, value] of Object.entries(container)) {
      if (["evidence_refs", "source_ids", "authority_source_ids"].includes(key)) continue;
      rows.push([
        key === "text" ? prefix : `${prefix} ${humanizeCorpusValue(key).toLocaleLowerCase("en")}`,
        readableValue(value),
      ]);
    }
  }
  return rows;
}

function RecordedFields({ detail }: { detail: CorpusRecordDetail }) {
  const { index } = detail;
  const rows: readonly [string, string][] =
    index.family === "legal_policy"
      ? [
          ["Legal force", humanizeCorpusValue(index.legalForce ?? "unknown")],
          ["Adoption", humanizeCorpusValue(index.adoption ?? "unknown")],
          ["Applicability", humanizeCorpusValue(index.applicability ?? "unknown")],
          ["Enforcement", humanizeCorpusValue(index.enforcement ?? "unknown")],
        ]
      : institutionalRows(detail);
  return (
    <section>
      <SectionLabel>What Writ recorded</SectionLabel>
      <dl className="mt-2">
        {rows.map(([label, value]) => (
          <ValueRow key={label} label={label} value={value} />
        ))}
      </dl>
    </section>
  );
}

function Evidence({ detail }: { detail: CorpusRecordDetail }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4">
        <SectionLabel>Evidence</SectionLabel>
        <span className="text-[0.68rem] text-muted-foreground">
          {humanizeCorpusValue(detail.index.traceState)}
        </span>
      </div>
      <div className="mt-2 divide-y divide-border">
        {detail.evidence.map((support, index) => (
          <article key={support.supportId} className="py-4 first:pt-2">
            {detail.evidence.length > 1 ? (
              <p className="mb-2 text-[0.66rem] text-muted-foreground">
                Support {index + 1} of {detail.evidence.length}
              </p>
            ) : null}
            {support.state === "traced" ? (
              <>
                <p className="text-[0.8rem] font-medium leading-5">
                  {support.source.title ?? "Canonical source"}
                </p>
                {support.locator ? (
                  <p className="mt-0.5 text-[0.72rem] text-muted-foreground">{support.locator}</p>
                ) : null}
                <blockquote className="mt-3 border-l border-border pl-3 font-serif text-[0.82rem] leading-6 text-foreground/90">
                  “{support.quote}”
                </blockquote>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[0.68rem] text-muted-foreground">
                  {support.source.retrievedAt ? (
                    <span>Retrieved {support.source.retrievedAt}</span>
                  ) : null}
                  {support.source.uri ? (
                    <a
                      href={support.source.uri}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Open source <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-3">
                <p className="text-[0.78rem] font-medium">This support is not yet traced.</p>
                <p className="mt-1 text-[0.74rem] leading-5 text-muted-foreground">
                  {support.reason ?? "No canonical passage is registered for this support."}
                </p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function CodeDisclosure({
  label,
  content,
  language,
}: {
  label: string;
  content: string;
  language: string;
}) {
  return (
    <details className="group border-t border-border py-3">
      <summary className="cursor-pointer list-none text-[0.76rem] font-medium text-foreground/85 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {label}
      </summary>
      <pre className="mt-3 max-h-[28rem] overflow-auto rounded-lg bg-muted/60 p-3 font-mono text-[0.67rem] leading-5 text-foreground/85">
        <code data-language={language}>{content}</code>
      </pre>
    </details>
  );
}

function ReadyInspector({ detail, onClose }: { detail: CorpusRecordDetail; onClose: () => void }) {
  const { index } = detail;
  return (
    <div>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-5">
        <div className="min-w-0">
          <p className="text-[0.67rem] text-muted-foreground">
            {index.jurisdiction} · {humanizeCorpusValue(index.family)} ·{" "}
            {index.corpusStatus === "draft" ? "Draft corpus" : "Active corpus"} ·{" "}
            {humanizeCorpusValue(index.reviewState)} record
          </p>
          <h2 className="mt-1 text-[1.05rem] leading-6 tracking-[-0.02em]">{index.title}</h2>
          <p className="mt-1 text-[0.72rem] text-muted-foreground">{index.corpusTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close record inspector"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="space-y-6 px-5 py-5">
        <RecordedFields detail={detail} />

        <section>
          <SectionLabel>
            {index.family === "legal_policy" ? "Reviewed interpretation" : "Assertion"}
          </SectionLabel>
          <p className="mt-2 text-[0.84rem] leading-6 text-foreground/90">
            {detail.interpretation ?? detail.assertion}
          </p>
        </section>

        <Evidence detail={detail} />

        {detail.uncertainties.length > 0 ? (
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer list-none text-[0.68rem] font-medium tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Limits / uncertainty · {detail.uncertainties.length}
            </summary>
            <ul className="mt-3 space-y-3">
              {detail.uncertainties.map((uncertainty, index) => (
                <li
                  key={`${uncertainty.type}-${index}`}
                  className="text-[0.76rem] leading-5 text-muted-foreground"
                >
                  <span className="mr-1 text-foreground/80">
                    {humanizeCorpusValue(uncertainty.type)}.
                  </span>
                  {uncertainty.description}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <section>
          <SectionLabel>Structured source</SectionLabel>
          <div className="mt-2">
            <CodeDisclosure
              label={
                index.family === "legal_policy" ? "View stored YAML" : "View canonical .writ source"
              }
              content={detail.storedSource.content}
              language={detail.storedSource.language}
            />
            {detail.compiledOutput ? (
              <CodeDisclosure
                label="View compiled output"
                content={JSON.stringify(detail.compiledOutput, null, 2)}
                language="json"
              />
            ) : null}
          </div>
        </section>

        <details className="border-t border-border pt-4">
          <summary className="cursor-pointer list-none text-[0.68rem] font-medium tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Technical details
          </summary>
          <dl className="mt-3">
            <ValueRow label="Corpus" value={detail.technical.corpusId} />
            <ValueRow label="Record ID" value={detail.technical.recordId} />
            <ValueRow label="Display ID" value={detail.technical.displayId} />
            <ValueRow label="Review state" value={detail.technical.reviewState} />
            <ValueRow label="Corpus status" value={detail.technical.corpusStatus} />
            <ValueRow label="Source path" value={detail.technical.sourcePath} />
          </dl>
          <div className="mt-4 space-y-3">
            {detail.evidence.map((support, index) => (
              <div
                key={support.supportId}
                className="rounded-lg bg-muted/50 p-3 font-mono text-[0.64rem] leading-5 break-all text-muted-foreground"
              >
                <p>
                  support {index + 1}: {support.supportId}
                </p>
                {support.passageHash ? <p>passage: {support.passageHash}</p> : null}
                {support.documentHash ? <p>document: {support.documentHash}</p> : null}
              </div>
            ))}
          </div>
        </details>

        {index.labRecordId ? (
          <Link
            href={{ pathname: "/lab", query: { record: index.labRecordId } }}
            className="inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-primary hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Inspect in Lab <ExternalLink className="size-3" aria-hidden />
          </Link>
        ) : (
          <p className="text-[0.74rem] text-muted-foreground">Lab view not yet available</p>
        )}
      </div>
    </div>
  );
}

export function CorpusInspector({
  state,
  detail,
  error,
  onClose,
}: {
  state: InspectorState;
  detail: CorpusRecordDetail | null;
  error: string | null;
  onClose: () => void;
}) {
  if (state === "ready" && detail) return <ReadyInspector detail={detail} onClose={onClose} />;
  if (state === "loading") {
    return (
      <div
        className="flex min-h-64 items-center justify-center gap-2 px-6 text-sm text-muted-foreground"
        aria-live="polite"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading canonical record…
      </div>
    );
  }
  if (state === "not_found" || state === "error") {
    return (
      <div className="px-6 py-10" role="status">
        <p className="text-sm font-medium">
          {error ?? "That record is not present in the current corpus."}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-sm text-primary hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Clear selection
        </button>
      </div>
    );
  }
  return (
    <div className="px-6 py-10 text-sm leading-6 text-muted-foreground">
      Select a record to inspect what Writ recorded, the evidence behind it, and its canonical
      source.
    </div>
  );
}
