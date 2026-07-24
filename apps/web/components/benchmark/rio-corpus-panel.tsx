"use client";

import { useState } from "react";

import type { PublishedResult, RioCommitmentView, RioReportView } from "@/lib/rio-corpus";
import { cn } from "@/lib/utils";

/**
 * The imported G20 2024 Rio corpus, as published.
 *
 * Every cell here is the score printed by the G20 Research Group and carried
 * through verbatim by the Rio adapter. Writ computes nothing on this page: there
 * is no computed column, no reproduction claim, and no derived average.
 */

interface Props {
  reports: RioReportView[];
  commitments: RioCommitmentView[];
  members: { id: string; label: string }[];
}

const SCORE_STYLES: Record<string, string> = {
  "+1": "text-true",
  "0": "text-ink-soft",
  "-1": "text-false",
  not_applicable: "text-ink-faint",
};

function scoreLabel(value: PublishedResult): string {
  if (value === null) return "—";
  if (value === "not_applicable") return "n/a";
  return value;
}

function formatDate(value: string | null): string {
  if (!value) return "not published";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleString("en", {
    month: "long",
    timeZone: "UTC",
  });
  return `${Number(day)} ${monthName} ${year}`;
}

export function RioCorpusPanel({ reports, commitments, members }: Props) {
  const [activeReportId, setActiveReportId] = useState(reports[0]?.reportId ?? "");
  const active = reports.find((report) => report.reportId === activeReportId) ?? reports[0];

  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Report selector — interim and final are separate records, never merged. */}
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-medium text-primary">Published compliance report</p>
          <div
            role="tablist"
            aria-label="Rio compliance report stage"
            className="mt-3 inline-flex rounded-lg border border-border p-1"
          >
            {reports.map((report) => (
              <button
                key={report.reportId}
                type="button"
                role="tab"
                aria-selected={report.reportId === active.reportId}
                onClick={() => setActiveReportId(report.reportId)}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  report.reportId === active.reportId
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {report.stageLabel}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:text-right">
          <div className="sm:col-span-2 sm:flex sm:justify-end sm:gap-3">
            <dt className="text-muted-foreground">Assessment window</dt>
            <dd className="tabular-nums">
              {formatDate(active.windowStart)} – {formatDate(active.windowEnd)}
            </dd>
          </div>
          <div className="sm:col-span-2 sm:flex sm:justify-end sm:gap-3">
            <dt className="text-muted-foreground">Published</dt>
            <dd className="tabular-nums">{formatDate(active.publicationDate)}</dd>
          </div>
          <div className="sm:col-span-2 sm:flex sm:justify-end sm:gap-3">
            <dt className="text-muted-foreground">Imported assessments</dt>
            <dd className="tabular-nums">{active.assessmentCount}</dd>
          </div>
        </dl>
      </div>

      {active.extractionWarnings.length > 0 ? (
        <p className="border-b border-border bg-gold-wash px-5 py-3 text-[0.82rem] leading-relaxed text-ink-soft sm:px-6">
          Source discrepancy recorded in the review queue, not resolved:{" "}
          <span className="font-mono text-[0.76rem]">
            {active.extractionWarnings.join(", ")}
          </span>
          . The assessment window above is the monitoring window stated in the report&rsquo;s scoring
          section.
        </p>
      ) : null}

      {/* The published score matrix: 13 selected commitments x 21 members. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <caption className="sr-only">
            Published compliance scores for the {active.stageLabel.toLowerCase()} report, by
            commitment and G20 member.
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="label-mono px-4 py-3 font-normal">
                Selected commitment
              </th>
              {members.map((member) => (
                <th
                  key={member.id}
                  scope="col"
                  className="px-2 py-3 text-center align-bottom font-normal"
                >
                  <span className="block text-[0.68rem] leading-tight text-muted-foreground">
                    {member.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commitments.map((commitment) => {
              const row = commitment.scoresByReport[active.reportId] ?? {};
              return (
                <tr key={commitment.commitmentId} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="max-w-[22rem] px-4 py-3 text-left font-normal">
                    <span className="block text-[0.85rem] text-foreground">
                      {commitment.issueArea}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.68rem] text-ink-faint">
                      {commitment.commitmentId}
                    </span>
                  </th>
                  {members.map((member) => {
                    const value = row[member.id] ?? null;
                    return (
                      <td key={member.id} className="px-2 py-3 text-center">
                        <span
                          className={cn(
                            "font-mono text-[0.8rem] tabular-nums",
                            SCORE_STYLES[value ?? ""] ?? "text-ink-faint",
                          )}
                        >
                          {scoreLabel(value)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-5 py-4 text-[0.82rem] leading-relaxed text-muted-foreground sm:px-6">
        Scores are the published G20 Research Group results, imported exactly. <span className="font-mono">n/a</span>{" "}
        marks a commitment the report records as not applicable to that member. Writ has not scored,
        recomputed, or reproduced any of these values.
      </p>
    </div>
  );
}
