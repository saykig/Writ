import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { benchmark, loadExamples } from "@/lib/toolchain";
import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge } from "@/components/site/truth-badge";
import { Reveal } from "@/components/site/reveal";

/**
 * Slice the `score { … }` block out of a methodology source and locate its
 * `otherwise` line (1-based) so the CodeArtifact can mark only that line gold.
 */
function extractScoreBlock(source: string): { code: string; seamLine: number } {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.trimStart().startsWith("score {"));
  if (start === -1) return { code: source.trim(), seamLine: 0 };
  let end = start;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "}") {
      end = i;
      break;
    }
  }
  const slice = lines.slice(start, end + 1);
  const indent = slice[0].length - slice[0].trimStart().length;
  const dedented = slice.map((line) => line.slice(indent));
  const seamLine = dedented.findIndex((line) => line.trimStart().startsWith("otherwise")) + 1;
  return { code: dedented.join("\n"), seamLine };
}

const ENTRY_ROW =
  "group flex flex-col gap-2.5 py-7 transition-colors sm:px-7 sm:first:pl-0 sm:last:pr-0";

export default function Home() {
  const literal = loadExamples().find((example) => example.id === "literal");
  const { code, seamLine } = extractScoreBlock(literal?.source ?? "");
  const summary = benchmark().summary;

  const entries: { href: Route; label: string; blurb: string }[] = [
    {
      href: "/playground",
      label: "Playground",
      blurb:
        "Compile a rubric, watch the analyzer flag the gap, then evaluate a member and read the receipt.",
    },
    {
      href: "/benchmark",
      label: "Benchmark",
      blurb: `The 2025 G7 ledger: ${summary.matches} of ${summary.cells} published scores reproduced from frozen evidence.`,
    },
    {
      href: "/how-it-works",
      label: "How it works",
      blurb:
        "The four-valued engine, the governed evidence, and the content hashes anyone can recompute.",
    },
  ];

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[76rem] px-5 py-24 sm:px-6 sm:py-28 lg:py-36">
          <Reveal className="max-w-4xl">
            <SectionLabel>Auditable compliance · 2025 G7 commitments</SectionLabel>

            <h1 className="mt-7 font-display text-[clamp(2.6rem,6.4vw,4.7rem)] leading-[1.04] tracking-[-0.012em] text-balance">
              &ldquo;up to four strong actions.&rdquo;
            </h1>

            <Prose className="mt-8">
              Five words in a G7 rubric decide a country&rsquo;s score, and they can be read two
              ways. Covenant compiles the methodology into a program, evaluates it against a frozen,
              reviewed evidence snapshot, and returns{" "}
              <strong>a receipt anyone can recompute</strong>. Where a score turns on a reading
              rather than a fact, it says so.
            </Prose>

            <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={
                  <Link href="/playground">
                    Open the playground
                    <ArrowRight />
                  </Link>
                }
              />
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/how-it-works">How it works</Link>}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── One decisive artifact ────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 sm:py-28">
          <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <SectionLabel>The uncovered region</SectionLabel>
            <SectionHeading className="mt-4">One phrase, and the gap it leaves.</SectionHeading>
            <Prose className="mt-4 text-center [text-wrap:balance]">
              Read literally, <em className="text-foreground not-italic">up to four</em> is the
              range one to four. A country with zero strong actions and five weak ones satisfies no
              rule the score program declares.
            </Prose>
          </Reveal>

          <Reveal className="mx-auto mt-11 max-w-2xl" delay={90}>
            <CodeArtifact
              label="Literal reading · score"
              filename="2025-ai-sme-literal.covenant"
              code={code}
              seam={seamLine ? [seamLine] : []}
              caption={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.8rem] leading-relaxed">
                  <span className="text-foreground">strong_count 0, weak_count 5</span>
                  <span aria-hidden className="text-ink-faint">
                    &rarr;
                  </span>
                  <span className="text-ink-soft">no rule matches</span>
                  <span aria-hidden className="text-ink-faint">
                    &rarr;
                  </span>
                  <TruthBadge value="unresolved" />
                </span>
              }
            />
          </Reveal>
        </div>
      </section>

      {/* ── Three quiet entry points ─────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6 sm:py-28">
          <Reveal className="max-w-xl">
            <SectionLabel>Three ways in</SectionLabel>
            <SectionHeading className="mt-4">Read it, run it, or check the ledger.</SectionHeading>
          </Reveal>

          <Reveal
            className="mt-10 grid grid-cols-1 divide-y divide-rule border-y border-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            delay={90}
          >
            {entries.map((entry) => (
              <Link key={entry.href} href={entry.href} className={ENTRY_ROW}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-[1.4rem] leading-none tracking-[-0.01em] text-foreground">
                    {entry.label}
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 -translate-x-1 text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-foreground group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none" />
                </div>
                <p className="max-w-[42ch] text-[0.92rem] leading-relaxed text-ink-soft">
                  {entry.blurb}
                </p>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>
    </main>
  );
}
