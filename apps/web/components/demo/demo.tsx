"use client";

/**
 * The demo: one picture, one click.
 *
 * A provision answers this question only if all four conditions hold at once.
 * Laid out as a grid, that is something you see rather than read: across every
 * provision in the corpus, exactly one fills all four marks. Selecting a row
 * shows the official text behind it.
 *
 * Everything here is read from the reviewed table, the retrieved documents, and
 * the receipts the evaluator produced.
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RuleRow {
  id: string;
  place: "EU" | "US";
  /** Short, readable citation. */
  label: string;
  conditions: { label: string; met: boolean; actual: string | null }[];
  quote: string | null;
  citation: string | null;
  uri: string | null;
}

export interface Verdict {
  place: string;
  answer: string;
  note: string;
  /** The provisions that satisfied every condition, if any did. */
  citations: string[];
  considered: number;
  untraced: number;
}

export interface DemoView {
  question: string;
  conditionLabels: string[];
  rows: RuleRow[];
  verdicts: Verdict[];
  sourcing: { sourced: number; total: number };
}

/** A condition mark. Filled means the condition holds. */
function Mark({ met }: { met: boolean }) {
  return (
    <span
      className={cn(
        "block size-2.5 rounded-full transition-colors",
        met ? "bg-[var(--demo-accent)]" : "border border-muted-foreground/30 bg-transparent",
      )}
    />
  );
}

const GRID =
  "grid grid-cols-[minmax(0,1fr)_repeat(4,2.75rem)] gap-x-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,4.5rem)]";

const PLACE_NAMES: Record<"EU" | "US", string> = {
  EU: "European Union",
  US: "United States — federal",
};

export function Demo({ view }: { view: DemoView }) {
  const [selectedId, setSelectedId] = React.useState(
    view.rows.find(
      (row) => row.conditions.length > 0 && row.conditions.every((condition) => condition.met),
    )?.id ??
      view.rows[0]?.id ??
      "",
  );
  const selected = view.rows.find((row) => row.id === selectedId) ?? view.rows[0];

  const places = (["EU", "US"] as const).filter((place) =>
    view.rows.some((row) => row.place === place),
  );

  return (
    <main
      style={{ "--demo-accent": "oklch(0.68 0.15 25)" } as React.CSSProperties}
      className="mx-auto w-full max-w-[58rem] px-5 py-14 sm:px-6 sm:py-20"
    >
      <header className="text-center">
        <Badge variant="outline" className="text-[0.66rem] tracking-[0.12em] uppercase">
          Human-reviewed pilot
        </Badge>
        <h1 className="mx-auto mt-6 max-w-[22ch] text-[1.7rem] leading-[1.24] font-semibold tracking-[-0.02em] text-balance sm:text-[2.1rem]">
          {view.question}
        </h1>
      </header>

      {/* Both answers, side by side, before any explanation. */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {view.verdicts.map((verdict, index) => (
          <div
            key={verdict.place}
            className={cn(
              "rounded-xl border px-5 py-4 text-center",
              index === 0
                ? "border-[var(--demo-accent)]/45 bg-[var(--demo-accent)]/[0.06]"
                : "border-border",
            )}
          >
            <p className="text-[0.66rem] font-medium tracking-[0.1em] uppercase text-muted-foreground">
              {verdict.place}
            </p>
            <p
              className={cn(
                "mt-1.5 text-[1.9rem] leading-none font-semibold",
                index === 0 && "text-[var(--demo-accent)]",
              )}
            >
              {verdict.answer}
            </p>
            <p className="mt-2 text-[0.78rem] leading-5 text-muted-foreground text-balance">
              {verdict.note}
            </p>
            {verdict.citations.length > 0 ? (
              <p className="mt-2 font-mono text-[0.66rem] text-[var(--demo-accent)]">
                {verdict.citations.join(" · ")}
              </p>
            ) : null}
            <p className="mt-3 border-t border-border/60 pt-2 text-[0.68rem] text-muted-foreground">
              computed over {verdict.considered} provisions
              {verdict.untraced > 0 ? ` · ${verdict.untraced} not yet traced` : null}
            </p>
          </div>
        ))}
      </div>

      {/* The picture: all four marks must fill for a provision to count. */}
      <section className="mt-12">
        <p className="text-center text-[0.88rem] text-muted-foreground">
          A provision counts only if all four hold. Select one to read it.
        </p>

        <div className="tool mt-5 overflow-hidden">
          {/* Column headings */}
          <div className={cn(GRID, "items-end border-b border-border px-4 py-2.5")}>
            <span className="text-[0.66rem] tracking-[0.08em] uppercase text-muted-foreground">
              Provision
            </span>
            {view.conditionLabels.map((label) => (
              <span
                key={label}
                className="text-center text-[0.6rem] leading-tight tracking-[0.04em] uppercase text-muted-foreground sm:text-[0.66rem]"
              >
                {label}
              </span>
            ))}
          </div>

          {places.map((place) => {
            const rows = view.rows.filter((row) => row.place === place);
            return (
              <React.Fragment key={place}>
                <div className="flex items-baseline justify-between border-t border-border bg-muted/30 px-4 py-1.5">
                  <span className="text-[0.7rem] font-medium">{PLACE_NAMES[place]}</span>
                  <span className="text-[0.66rem] text-muted-foreground">
                    {rows.length} provisions
                  </span>
                </div>

                {rows.map((row) => {
                  const all =
                    row.conditions.length > 0 && row.conditions.every((condition) => condition.met);
                  const active = row.id === selectedId;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        GRID,
                        "w-full items-center border-t border-border/60 px-4 py-2.5 text-left outline-none transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                        active ? "bg-[var(--demo-accent)]/[0.08]" : "hover:bg-muted/40",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="shrink-0 font-mono text-[0.62rem] text-muted-foreground">
                          {row.id}
                        </span>
                        <span className="min-w-0 truncate text-[0.82rem]">{row.label}</span>
                        {all ? (
                          <span className="ml-auto hidden shrink-0 text-[0.7rem] font-medium text-[var(--demo-accent)] sm:inline">
                            counts
                          </span>
                        ) : null}
                      </span>
                      {row.conditions.map((condition) => (
                        <span
                          key={condition.label}
                          className="flex justify-center"
                          title={`${condition.label}: ${condition.actual ?? "not recorded"}`}
                        >
                          <Mark met={condition.met} />
                        </span>
                      ))}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* The selected provision, in the document's own words. */}
        {selected ? (
          <div aria-live="polite" className="mt-4 rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {selected.conditions.map((condition) => (
                <span key={condition.label} className="flex items-center gap-1.5 text-[0.72rem]">
                  <Mark met={condition.met} />
                  <span className="text-muted-foreground">{condition.label}</span>
                  <span className={cn(condition.met ? "text-foreground" : "text-muted-foreground")}>
                    {condition.actual ?? "not recorded"}
                  </span>
                </span>
              ))}
            </div>
            {selected.quote ? (
              <>
                <blockquote className="text-[0.9rem] leading-7">“{selected.quote}”</blockquote>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-muted-foreground">
                  <span className="font-medium text-foreground/80">{selected.citation}</span>
                  {selected.uri ? (
                    <>
                      <span aria-hidden>·</span>
                      <a
                        href={selected.uri}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 underline decoration-border underline-offset-4 hover:text-foreground"
                      >
                        read it
                        <ExternalLink aria-hidden className="size-2.5" />
                      </a>
                    </>
                  ) : null}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-border pt-7">
        <p className="text-[0.8rem] text-muted-foreground">
          {view.sourcing.total} reviewed records · {view.sourcing.sourced} traced to the official
          text
        </p>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button
            nativeButton={false}
            className="bg-[var(--demo-accent)] text-background hover:bg-[var(--demo-accent)]/85"
            render={
              <Link href="/playground">
                Change the rule
                <ArrowRight />
              </Link>
            }
          />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/how-it-works">How it works</Link>}
          />
        </div>
      </div>
    </main>
  );
}
