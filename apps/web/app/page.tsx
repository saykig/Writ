import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { benchmark, loadExamples } from "@/lib/toolchain";
import { gapMatrix } from "@/lib/gap-matrix";
import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Pipeline } from "@/components/site/pipeline";
import { FeatureGrid } from "@/components/site/feature-grid";
import { ReceiptVisual } from "@/components/site/receipt-visual";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
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

export default function Home() {
  const literal = loadExamples().find((example) => example.id === "literal");
  const { code, seamLine } = extractScoreBlock(literal?.source ?? "");
  const summary = benchmark().summary;
  const gap = gapMatrix();
  const authority = gap.axes.find((axis) => axis.id === "public_authority");

  const proofs: {
    href: Route;
    kicker: string;
    title: string;
    blurb: string;
    stat: string;
    statNote: string;
  }[] = [
    {
      href: "/benchmark",
      kicker: "2025 G7 AI-for-SMEs",
      title: "Reproduced on real data",
      blurb: `All ${summary.cells} published member scores recomputed from frozen, reviewed evidence. ${summary.interpretation_sensitive_cells} of them turn on how one phrase is read.`,
      stat: `${summary.matches}/${summary.cells}`,
      statNote: "scores reproduced",
    },
    {
      href: "/gap-matrix",
      kicker: "AI-governance Gap Matrix",
      title: "A different scoring shape",
      blurb:
        "A weighted-ordinal index across four jurisdictions, reproduced exactly — including an axis left honestly pending because two components are unassessed.",
      stat: authority?.index != null ? String(authority.index) : "—",
      statNote: "public-authority index",
    },
  ];

  return (
    <main>
      {/* ── Hero: what Covenant is, plainly + the signature artifact ─────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_30%,transparent_95%)]"
        >
          <FlickeringGrid
            className="absolute inset-0 size-full"
            squareSize={3}
            gridGap={10}
            flickerChance={0.08}
            maxOpacity={0.28}
            color="#9ca3af"
          />
        </div>
        <div aria-hidden className="absolute inset-0 backdrop-glow" />
        <div className="relative mx-auto grid max-w-[76rem] items-center gap-12 px-5 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:py-28">
          <Reveal>
            <SectionLabel>Auditable policy scoring</SectionLabel>
            <h1 className="mt-6 text-[length:var(--t-hero)] leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              Make a policy score show its work.
            </h1>
            <Prose className="mt-7">
              A compliance score is a single number, but behind it sits a rubric full of reading
              calls you usually cannot see or reproduce. Covenant compiles the rubric into a
              program: it <strong>catches ambiguity before any evidence exists</strong>, scores
              against a frozen, reviewed record, and returns every number as a{" "}
              <strong>receipt anyone can recompute</strong>. Where a score turns on a reading rather
              than a fact, it says so.
            </Prose>
            <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Button
                variant="default"
                size="lg"
                nativeButton={false}
                render={
                  <Link href="/benchmark">
                    See it on real G7 data
                    <ArrowRight />
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={<Link href="/playground">Try it live</Link>}
              />
            </div>
          </Reveal>

          <Reveal className="flex justify-center lg:justify-end" delay={120}>
            <ReceiptVisual />
          </Reveal>
        </div>
      </section>

      {/* ── The four things it does differently ──────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>Why it&rsquo;s different</SectionLabel>
            <SectionHeading className="mt-4">
              A compiler&rsquo;s discipline, for policy scoring.
            </SectionHeading>
          </Reveal>
          <Reveal className="mt-9" delay={90}>
            <FeatureGrid />
          </Reveal>
        </div>
      </section>

      {/* ── The pipeline, in one glance ──────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>How it works</SectionLabel>
            <SectionHeading className="mt-4">Rubric in, auditable receipt out.</SectionHeading>
          </Reveal>
          <Reveal className="mt-9" delay={90}>
            <Pipeline />
          </Reveal>
        </div>
      </section>

      {/* ── The decisive example ─────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>See it happen</SectionLabel>
            <SectionHeading className="mt-4">Five words, and the gap they leave.</SectionHeading>
            <Prose className="mt-4">
              The 2025 G7 rubric awards a middle score for &ldquo;up to four strong actions.&rdquo;
              Read literally, that is the range one to four — so a country with{" "}
              <em className="text-foreground not-italic">zero</em> strong actions and five weak ones
              matches no rule at all. Covenant proves that gap statically, before any
              country&rsquo;s evidence is loaded.
            </Prose>
          </Reveal>

          <Reveal className="mt-9 max-w-2xl" delay={90}>
            <CodeArtifact
              label="Literal reading · score"
              filename="2025-ai-sme-literal.covenant"
              code={code}
              seam={seamLine ? [seamLine] : []}
              caption={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.8rem] leading-relaxed">
                  <span className="text-foreground">strong 0, weak 5</span>
                  <span aria-hidden className="text-muted-foreground">
                    &rarr;
                  </span>
                  <span className="text-muted-foreground">no rule matches</span>
                  <span aria-hidden className="text-muted-foreground">
                    &rarr;
                  </span>
                  <TruthBadge value="unresolved" />
                </span>
              }
            />
          </Reveal>
        </div>
      </section>

      {/* ── Proof: two methodologies ─────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel>Proven, not asserted</SectionLabel>
            <SectionHeading className="mt-4">Two methodologies, two scoring shapes.</SectionHeading>
            <Prose className="mt-4">
              Covenant reproduces published scores it did not write, on two genuinely different
              rubrics — a G7 three-point verdict and a weighted-ordinal governance index.
            </Prose>
          </Reveal>

          <Reveal className="mt-9 grid gap-5 md:grid-cols-2" delay={90}>
            {proofs.map((proof) => (
              <Link
                key={proof.href}
                href={proof.href}
                className="tool group flex flex-col gap-4 p-6 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label">{proof.kicker}</p>
                    <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{proof.title}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-semibold tracking-tight tabular-nums">
                      {proof.stat}
                    </span>
                    <p className="label mt-0.5">{proof.statNote}</p>
                  </div>
                </div>
                <p className="text-[0.9rem] leading-relaxed text-muted-foreground">{proof.blurb}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  Explore
                  <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </span>
              </Link>
            ))}
          </Reveal>

          <Reveal className="mt-8" delay={140}>
            <Link
              href="/how-it-works"
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Read how the language, engine, and evidence fit together
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
