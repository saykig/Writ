import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A hand-rendered architecture figure for the Covenant pipeline, in the Seam
 * palette. Two governed lanes — a normative methodology and reviewed evidence,
 * each pinned by a content hash — converge on a deterministic evaluator that
 * emits a proof-carrying receipt. Pure HTML/SVG: real DOM text (selectable,
 * legible at every width), theme-aware via the color tokens, no diagram library.
 *
 * Mirrors docs/architecture.mmd.
 */

type Accent = "plain" | "gold" | "indigo";

const ACCENT: Record<Accent, string> = {
  plain: "border-border bg-surface-2/40",
  gold: "border-gold/40 bg-gold-wash",
  indigo: "border-indigo/40 bg-indigo/[0.06]",
};

function Node({
  kicker,
  title,
  sub,
  accent = "plain",
  className,
}: {
  kicker: string;
  title: string;
  sub?: string;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[4px] border px-4 py-3 ring-1 ring-foreground/[0.02]",
        ACCENT[accent],
        className,
      )}
    >
      <span
        className={cn(
          "font-mono text-[0.6rem] tracking-[0.14em] uppercase",
          accent === "gold" ? "text-gold" : accent === "indigo" ? "text-indigo" : "text-ink-faint",
        )}
      >
        {kicker}
      </span>
      <span className="font-serif text-[0.98rem] leading-tight tracking-tight text-foreground">
        {title}
      </span>
      {sub ? <span className="text-xs leading-snug text-ink-soft">{sub}</span> : null}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div aria-hidden className="flex flex-col items-center gap-0.5 py-1.5">
      <span className="h-3 w-px bg-border" />
      <ChevronDown className="size-3.5 text-ink-faint" />
      {label ? (
        <span className="font-mono text-[0.6rem] tracking-[0.08em] text-gold">{label}</span>
      ) : null}
    </div>
  );
}

function Lane({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative flex flex-col rounded-[5px] border border-border/70 bg-background/30 p-4">
      <span className="label-mono mb-3 flex items-center gap-2">
        <span aria-hidden className="inline-block h-3 w-px shrink-0 bg-gold" />
        {label}
      </span>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

const HASHES = [
  "methodology_bundle_hash",
  "evidence_snapshot_hash",
  "interpretation_profile_hash",
  "evaluator_build_hash",
  "canonical_hash",
];

export function ArchitectureDiagram() {
  return (
    <figure className="rounded-[6px] border border-border bg-surface/40 p-5 ring-1 ring-foreground/[0.03] sm:p-8">
      <figcaption className="label-mono mb-6">
        Source → canonical IR → evaluator → receipt
      </figcaption>

      {/* Two governed input lanes */}
      <div className="grid gap-5 md:grid-cols-2">
        <Lane label="Normative methodology">
          <Node kicker="written" title=".covenant source" sub="A rubric as a small DSL." />
          <Arrow />
          <Node kicker="compile" title="Compiler" sub="Type, link, canonicalize." />
          <Arrow />
          <Node kicker="artifact" title="Canonical IR" sub="Typed, hashable, versioned." />
          <Arrow label="proven total · non-overlapping" />
          <Node
            kicker="prove"
            title="Static analyzer"
            sub="Gaps and overlaps caught before evidence."
            accent="gold"
          />
        </Lane>

        <Lane label="Reviewed evidence">
          <Node kicker="collect" title="Public sources" sub="Snapshotted, passage-anchored." />
          <Arrow />
          <Node
            kicker="adjudicate"
            title="Human review"
            sub="A candidate becomes a fact only here."
            accent="gold"
          />
          <Arrow />
          <Node
            kicker="freeze"
            title="Frozen snapshot"
            sub="Content-hashed, append-only, immutable."
          />
        </Lane>
      </div>

      {/* Converge */}
      <div aria-hidden className="flex flex-col items-center gap-0.5 py-2">
        <span className="h-4 w-px bg-border" />
        <ChevronDown className="size-4 text-ink-faint" />
        <span className="font-mono text-[0.6rem] tracking-[0.08em] text-ink-faint">
          both lanes, pinned by hash
        </span>
      </div>

      <Node
        kicker="derive"
        title="Deterministic evaluator"
        sub="No network · no wall-clock · no randomness · no mutation."
        accent="indigo"
        className="mx-auto max-w-xl text-center [&>span]:mx-auto"
      />

      <Arrow />

      {/* Receipt with proof tree + five hashes */}
      <div className="mx-auto max-w-xl rounded-[5px] border border-gold/40 bg-gold-wash p-4 ring-1 ring-foreground/[0.02]">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] tracking-[0.14em] text-gold uppercase">
            emit
          </span>
          <span className="font-serif text-[0.98rem] leading-tight tracking-tight text-foreground">
            Evaluation receipt
          </span>
          <span className="text-xs leading-snug text-ink-soft">
            Result, result-status, matched rule, and a proof tree of four-valued nodes.
          </span>
        </div>
        <div className="mt-3 border-t border-gold/25 pt-3">
          <span className="label-mono">Five content hashes</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HASHES.map((h) => (
              <span
                key={h}
                className="rounded-[3px] border border-border bg-background/50 px-1.5 py-0.5 font-mono text-[0.62rem] text-ink-soft"
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Arrow />

      <div className="grid gap-5 md:grid-cols-2">
        <Node
          kicker="compare"
          title="Benchmark matrix"
          sub="Published vs. computed, cell by cell."
        />
        <Node kicker="publish" title="Signed release" sub="Immutable, replayable, verifiable." />
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
        <span aria-hidden className="inline-block h-3 w-px bg-gold" />
        Models may propose candidates into review; they never publish a score.
      </p>
    </figure>
  );
}
