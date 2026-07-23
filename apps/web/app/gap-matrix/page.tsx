import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { gapMatrix, type GapMatrixAxis } from "@/lib/gap-matrix";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { HeroBackdrop } from "@/components/site/hero-backdrop";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Gap Matrix · Covenant",
  description:
    "A second methodology: Sara Kim's frontier-AI governance Gap Matrix, a weighted-ordinal index, reproduced by Covenant — including a genuinely pending axis.",
};

/** A single component's assessed ordinal level, or a pending marker. */
function LevelPips({ level, pending }: { level: number | null; pending: boolean }) {
  if (pending || level === null) {
    return <span className="text-xs font-medium tracking-wide text-gold uppercase">pending</span>;
  }
  return (
    <span className="flex items-center gap-1" aria-label={`level ${level} of 4`}>
      {[0, 1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={
            n <= level ? "size-1.5 rounded-full bg-foreground" : "size-1.5 rounded-full bg-border"
          }
        />
      ))}
      <span className="ml-1.5 font-mono text-xs text-muted-foreground tabular-nums">{level}/4</span>
    </span>
  );
}

function AxisCard({ axis }: { axis: GapMatrixAxis }) {
  return (
    <div className="tool flex flex-col gap-5 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-tight">{axis.label}</h3>
        <div className="text-right">
          {axis.pending ? (
            <span className="text-2xl font-semibold tracking-tight text-gold">pending</span>
          ) : (
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{axis.index}</span>
          )}
          <p className="label mt-0.5">index / 100</p>
        </div>
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {axis.components.map((component) => (
          <li key={component.id} className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm text-muted-foreground">{component.label}</span>
            <LevelPips level={component.level} pending={component.pending} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function GapMatrixPage() {
  const result = gapMatrix();
  const pendingComponents = result.axes
    .flatMap((axis) => axis.components)
    .filter((component) => component.pending);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-[76rem] px-5 py-20 sm:px-6 sm:py-28">
          <Reveal className="max-w-3xl">
            <SectionLabel>Second methodology · AI governance</SectionLabel>
            <h1 className="mt-6 text-[length:var(--t-hero)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              Who knows, and who decides.
            </h1>
            <Prose className="mt-7">
              Covenant&rsquo;s first benchmark scores a G7 rubric on a three-point scale. This is a
              different methodology and a different scoring shape:{" "}
              <strong>Sara Kim&rsquo;s Gap Matrix</strong>, a frontier-AI governance index across
              the EU, US, UK, and China. Each axis is five weighted components, each on a
              five-anchor ordinal rubric, aggregated as <strong>round(100 · Σ wᵢ·sᵢ / 4)</strong>.
              Covenant reproduces her computation exactly, and the distance between the two axes is
              the governance gap.
            </Prose>
          </Reveal>
        </div>
      </section>

      {/* ── The two axes (reproduced live) ───────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>Reproduced from her assessments</SectionLabel>
            <SectionHeading className="mt-4">Two indices, one of them pending.</SectionHeading>
            <Prose className="mt-4">
              Public authority resolves to <strong>{result.axes[1]?.index}</strong> — all five
              components assessed at level 2. Knowledge concentration is <strong>pending</strong>:
              two of its five components are not yet assessed, so the index is null, never a silent
              zero. This reproduces her engine&rsquo;s &ldquo;if some score is null, return
              null&rdquo; exactly.
            </Prose>
          </Reveal>

          <Reveal className="mt-10 grid gap-5 md:grid-cols-2" delay={90}>
            {result.axes.map((axis) => (
              <AxisCard key={axis.id} axis={axis} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Who bears the risk ───────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>What the analyzer says</SectionLabel>
            <SectionHeading className="mt-4">
              Where a single judgment carries the result.
            </SectionHeading>
            <Prose className="mt-4">
              Before any more evidence is gathered, the analyzer reports each axis{" "}
              <em className="text-foreground not-italic">pending-decisive</em>: the index turns on
              every component, so any one unresolved judgment blocks it. Here, two components hold
              the whole knowledge-concentration axis pending.
            </Prose>
          </Reveal>

          <Reveal className="seam mt-8 max-w-2xl rounded-r-lg py-4 pr-4 pl-5" delay={90}>
            <p className="label">Pending, and decisive</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {pendingComponents.map((component) => (
                <li key={component.id} className="text-sm text-foreground">
                  {component.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <Prose>
              Expressing this required extending Covenant&rsquo;s intermediate representation with a
              graded weighted-ordinal measure — the AI-for-SMEs three-point path could not represent
              it. One methodology was an anecdote; two that behave the same way, across two scoring
              paradigms, is the start of a generality claim.
            </Prose>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
              <Link
                href="/benchmark"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                The G7 benchmark
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
              <Link
                href="/how-it-works"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
              >
                How it works
                <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
