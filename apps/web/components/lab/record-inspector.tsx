"use client";

/**
 * How one exact source passage becomes one durable structured record.
 *
 * The passage on the left, prominent, with the record beneath it; the record in
 * ordinary words on the right. Moving over an explanation on the right lights
 * the phrase it rests on in the passage, the field it was recorded in, and the
 * line of the stored record where that field lives — the same claim, three ways,
 * at once.
 *
 * Guided opens by default. Code is the record as stored, available but never
 * first: reading YAML is not the price of understanding what a record says.
 */

import * as React from "react";

import { SourcePassage } from "@/components/record/source-passage";
import { StructuredRecord } from "@/components/record/structured-record";
import { RecordStatus } from "@/components/record/record-status";
import { VersionMetadata } from "@/components/record/version-metadata";
import { CodeArtifact } from "@/components/site/code-artifact";
import { labExplanationSections } from "@/lib/lab-explanation";
import { checksSummary, type RecordCheck } from "@/lib/record-checks";
import type { LabRecordResolution, LabRecordSummary, LabRecordView } from "@/lib/record-view";
import type { RecordFieldKey } from "@/lib/record-view";
import { RecordExplanation } from "./record-explanation";
import { RecordHeader, type JurisdictionFilter } from "./record-header";

export interface RecordInspectorProps {
  views: readonly LabRecordView[];
  summaries: readonly LabRecordSummary[];
  checks: Readonly<Record<string, readonly RecordCheck[]>>;
  resolution: LabRecordResolution;
  initialView: "guided" | "code";
  corpusLabel: string;
  /** Rendered below the record; the workbench, collapsed. */
  technicalDetails: React.ReactNode;
}

export function RecordInspector({
  views,
  summaries,
  checks,
  resolution,
  initialView,
  corpusLabel,
  technicalDetails,
}: RecordInspectorProps) {
  const [selectedId, setSelectedId] = React.useState(resolution.id);
  const [jurisdiction, setJurisdiction] = React.useState<JurisdictionFilter>("all");
  const [view, setView] = React.useState(initialView);
  const [activeSection, setActiveSection] = React.useState<string | null>(null);
  const [activeFields, setActiveFields] = React.useState<readonly RecordFieldKey[]>([]);

  const record = views.find((item) => item.claimId === selectedId) ?? views[0];
  const recordChecks = React.useMemo(() => checks[record.claimId] ?? [], [checks, record.claimId]);
  const sections = React.useMemo(
    () => labExplanationSections(record, recordChecks),
    [record, recordChecks],
  );

  const select = React.useCallback((id: string) => {
    setSelectedId(id);
    setActiveSection(null);
    setActiveFields([]);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("record", id);
      window.history.replaceState(null, "", url);
    }
  }, []);

  // Narrowing the jurisdiction should never leave a record from the other one on
  // screen, so the first record still in view is opened.
  const filterJurisdiction = React.useCallback(
    (next: JurisdictionFilter) => {
      setJurisdiction(next);
      if (next !== "all" && record.jurisdiction !== next) {
        const first = summaries.find((summary) => summary.jurisdiction === next);
        if (first) select(first.id);
      }
    },
    [record.jurisdiction, select, summaries],
  );

  const focusSection = React.useCallback((id: string | null, fields: readonly RecordFieldKey[]) => {
    setActiveSection(id);
    setActiveFields(fields);
  }, []);

  // The highlight resolves to one field: the first in the focused set that is
  // actually anchored in the retrieved passage. A section whose fields are all
  // grounded outside the quoted span lights nothing, which is the honest answer.
  const anchoredField =
    activeFields
      .map((key) => record.fields.find((field) => field.key === key))
      .find((field) => field?.anchor) ?? null;

  const highlightLines = activeFields.flatMap(
    (key) => record.fields.find((field) => field.key === key)?.codeLines ?? [],
  );

  const anchoredButUnhighlighted =
    activeFields.length > 0 && !anchoredField && record.source.state !== "unresolved";

  return (
    <div className="mx-auto w-full max-w-[92rem] px-5 py-8 sm:px-6 lg:py-10">
      <RecordHeader
        corpusLabel={corpusLabel}
        summaries={summaries}
        selectedId={record.claimId}
        jurisdiction={jurisdiction}
        view={view}
        resolution={resolution}
        onSelect={select}
        onJurisdiction={filterJurisdiction}
        onView={setView}
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
        {/* Left: the words, then the record they became. */}
        <div className="min-w-0 space-y-8">
          <section>
            <h2 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
              Source passage
            </h2>
            <div className="mt-3">
              <SourcePassage source={record.source} highlight={anchoredField?.anchor ?? null} />
            </div>
            {anchoredButUnhighlighted ? (
              <p className="mt-3 text-[0.72rem] leading-6 text-muted-foreground">
                These fields are grounded in wording outside the retrieved passage, so nothing is
                highlighted above.
              </p>
            ) : null}
          </section>

          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
                Structured record
              </h2>
              <span className="font-mono text-[0.68rem] text-muted-foreground">
                {record.claimId}
              </span>
            </div>
            <div className="mt-3">
              {view === "guided" ? (
                <StructuredRecord
                  fields={record.fields}
                  activeField={anchoredField?.key ?? activeFields[0] ?? null}
                />
              ) : (
                <CodeArtifact
                  code={record.code.text}
                  label={record.code.label}
                  filename={record.code.filename}
                  highlight={highlightLines}
                  caption={record.code.caption}
                />
              )}
            </div>
          </section>

          <RecordStatus checks={recordChecks} summary={checksSummary(recordChecks)} />

          <VersionMetadata
            heading="Corpus version"
            entries={[
              { label: "Dataset", value: record.versions.datasetId, mono: true },
              { label: "Schema", value: record.versions.schemaVersion, mono: true },
              { label: "Review status", value: record.versions.reviewStatus },
              { label: "Reviewed source", value: record.versions.datasetSource, mono: true },
            ]}
            hashes={
              record.source.document
                ? [{ label: "source bytes", hash: record.source.document.sha256 }]
                : []
            }
          />
        </div>

        {/* Right: the same record, in ordinary words. */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <RecordExplanation
            sections={sections}
            activeSection={activeSection}
            onFocusSection={focusSection}
          />
        </div>
      </div>

      <div className="mt-14">{technicalDetails}</div>
    </div>
  );
}
