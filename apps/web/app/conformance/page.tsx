import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Stat } from "@/components/site/stat";
import { loadCoverage, representativeCases } from "@/lib/conformance";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Conformance — Covenant",
  description:
    "An implementation-independent corpus: 130 declarative cases across 10 semantic areas that any evaluator must reproduce byte for byte. Pure data, mutation-tested, consumable by an alternate engine.",
};

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

const INVARIANTS = [
  {
    title: "Schema-valid",
    body: "Every produced receipt validates against evaluation-receipt.schema.json before its value is even compared.",
  },
  {
    title: "Self-verifying hash",
    body: "The receipt's self-describing canonical_hash is recomputed and must verify — the artifact attests to itself.",
  },
  {
    title: "Deterministic replay",
    body: "Two independent runs must produce byte-identical canonical JSON. No wall-clock, no randomness, no order dependence.",
  },
];

export default function ConformancePage() {
  const { areas, totalCases, totalFiles } = loadCoverage();
  const cases = representativeCases();
  const maxCases = Math.max(...areas.map((a) => a.cases));

  return (
    <main className="flex-1">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-24">
          <SectionLabel seam className={reveal}>
            Conformance
          </SectionLabel>
          <SectionHeading as="h1" className={cn("mt-5 text-4xl sm:text-5xl", reveal)}>
            The corpus, not the engine.
          </SectionHeading>
          <Prose className={cn("mt-6", reveal)}>
            A specification that any two implementations can read differently is not a
            specification. Covenant pins its meaning in an implementation-independent corpus:{" "}
            {totalCases} declarative cases, each a frozen input and the exact value the semantics
            require. The corpus imports nothing and depends on no engine — read a case, dispatch on
            its <code>kind</code>, run the input, and check the result. The reference stack is one
            consumer of it, not part of it.
          </Prose>
          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            <Stat
              value={String(totalCases)}
              label="Cases"
              sub="Fixed input, fixed expected value."
            />
            <Stat
              value={String(areas.length)}
              label="Semantic areas"
              sub="Truth through diagnostics."
            />
            <Stat
              value={String(totalFiles)}
              label="Case files"
              sub="Each validates against case.schema.json."
            />
            <Stat
              tone="gold"
              value="0"
              label="Engine dependencies"
              sub="Pure data. Any evaluator can consume it."
            />
          </div>
        </div>
      </section>

      {/* ── Coverage table ────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Coverage</SectionLabel>
            <SectionHeading className="mt-4">
              Ten areas, {totalCases} cases, counted from the files.
            </SectionHeading>
            <Prose className="mt-4">
              These counts are computed at build time from the corpus itself, not transcribed. Each
              area isolates one region of the semantics; together they hold the four-valued kernel,
              the query and identity logic, the temporal and quantity rules, canonicalization, and
              the stable diagnostic codes.
            </Prose>
          </div>

          <div className="mt-10 overflow-x-auto rounded-[4px] border border-border ring-1 ring-foreground/[0.03]">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left">
                  <th className="label-mono px-4 py-2.5 font-normal">Area</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Covers</th>
                  <th className="label-mono px-4 py-2.5 text-right font-normal">Files</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Cases</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[0.82rem] text-foreground">{area.id}</div>
                    </td>
                    <td className="max-w-md px-4 py-3 text-ink-soft">{area.covers}</td>
                    <td className="px-4 py-3 text-right font-mono text-[0.82rem] text-ink-faint tabular-nums">
                      {area.files}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 shrink-0 font-mono text-[0.82rem] text-foreground tabular-nums">
                          {area.cases}
                        </span>
                        <span
                          aria-hidden
                          className="h-1.5 rounded-full bg-gold/70"
                          style={{ width: `${(area.cases / maxCases) * 100}%`, minWidth: "0.5rem" }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2/40">
                  <td className="px-4 py-3 font-serif text-base">Total</td>
                  <td className="px-4 py-3 text-ink-faint">
                    consumable by any conformant evaluator
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[0.82rem] tabular-nums">
                    {totalFiles}
                  </td>
                  <td className="px-4 py-3 font-mono text-[0.82rem] text-gold tabular-nums">
                    {totalCases}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ── Mutation-tested + invariants ──────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div>
              <SectionLabel seam>Proven sensitive</SectionLabel>
              <SectionHeading className="mt-4">
                A test that never fails proves nothing.
              </SectionHeading>
              <Prose className="mt-4">
                The suite is mutation-tested: deliberate faults injected into the semantics — flip a
                truth-table cell, collapse unknown to false, drop an overlap check — are caught by
                the corpus. A passing run is therefore evidence that the cases discriminate, not
                merely that they are green.
              </Prose>
              <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-soft">
                Comparison is structural: objects compare key-by-key and ignore key order, arrays
                are order-sensitive, and diagnostic <em>codes</em> are collected and sorted, so a
                case pins the set of codes without depending on emission order or human wording.
              </p>
            </div>

            <div>
              <p className="label-mono mb-4">
                Every receipt case also enforces three hard invariants
              </p>
              <ol className="flex flex-col gap-px overflow-hidden border-t border-border">
                {INVARIANTS.map((inv, i) => (
                  <li
                    key={inv.title}
                    className="relative flex flex-col gap-1.5 bg-background/40 py-5 pl-6"
                  >
                    <span aria-hidden className="absolute top-5 left-0 h-4 w-px bg-gold" />
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-gold tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-serif text-lg tracking-tight">{inv.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">{inv.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── Representative cases ──────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Representative shapes</SectionLabel>
            <SectionHeading className="mt-4">
              Each case is pure data: id, area, kind, input, expected.
            </SectionHeading>
            <Prose className="mt-4">
              A truth-table entry, a distinct-count query under an identity policy, and a
              content-hash case — three of the {totalCases}, shown verbatim. The shapes of{" "}
              <code>input</code> and <code>expected</code> follow from the <code>kind</code>; the
              closed enums of areas and kinds live in{" "}
              <span className="font-mono text-[0.82rem]">case.schema.json</span>.
            </Prose>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {cases.map((c) => (
              <CodeArtifact
                key={c.caseData.id}
                label={`${c.caseData.area} · ${c.caseData.kind}`}
                filename={c.file}
                code={c.json}
                caption={
                  <span className="text-[0.82rem] leading-relaxed">{c.caseData.description}</span>
                }
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-20 sm:px-6">
          <SectionLabel seam>Where the values come from</SectionLabel>
          <SectionHeading className="max-w-2xl text-3xl sm:text-4xl">
            The corpus pins the semantics. The semantics come from the model.
          </SectionHeading>
          <Prose>
            Each expected value is derived from the formal semantics, not from any one
            implementation. Read the four-valued truth lattice, the canonical IR, and the receipt
            that ties them together.
          </Prose>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href="/how-it-works">
                  How it works
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/methodologies">Read the methodologies</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
