import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GitCompare,
  ListChecks,
  Scale,
  ScanSearch,
  ShieldCheck,
  SquareStack,
} from "lucide-react";

import { benchmark, evaluateMember, loadExamples } from "@/lib/toolchain";
import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { HashPill } from "@/components/site/hash-pill";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { Stat } from "@/components/site/stat";
import { TruthBadge } from "@/components/site/truth-badge";

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

const MEMBER_LABELS: Record<string, string> = {
  canada: "Canada",
  france: "France",
  germany: "Germany",
  italy: "Italy",
  japan: "Japan",
  united_kingdom: "United Kingdom",
  united_states: "United States",
  european_union: "European Union",
};

const CAPABILITIES: {
  title: string;
  href: Route;
  icon: typeof SquareStack;
  body: string;
}[] = [
  {
    title: "Compile",
    href: "/playground",
    icon: SquareStack,
    body: "A methodology written in the Covenant DSL compiles to a typed, canonical IR.",
  },
  {
    title: "Analyze",
    href: "/playground",
    icon: ScanSearch,
    body: "A static analyzer proves the score total and non-overlapping before any evidence exists.",
  },
  {
    title: "Evaluate",
    href: "/playground",
    icon: Scale,
    body: "A deterministic four-valued engine scores a subject and emits a receipt with a proof tree.",
  },
  {
    title: "Governed evidence",
    href: "/governance",
    icon: ShieldCheck,
    body: "Every claim resolves against a frozen, reviewed snapshot pinned by content hashes.",
  },
  {
    title: "Benchmark",
    href: "/benchmark",
    icon: GitCompare,
    body: "All eight G7 members’ 2025 published scores, reproduced from frozen evidence.",
  },
  {
    title: "Conformance",
    href: "/conformance",
    icon: ListChecks,
    body: "130 cross-implementation cases pin canonicalization, identity, temporal reasoning, and truth.",
  },
];

const MOVEMENTS = [
  {
    n: "01",
    title: "Compile & analyze",
    body: "Write the rubric as a program. The analyzer finds the uncovered gap — or the silent overlap — before a single claim of evidence is gathered.",
  },
  {
    n: "02",
    title: "Evaluate",
    body: "Score a member against a frozen snapshot. The four-valued engine returns a result, the proof tree behind it, and the evidence it stood on.",
  },
  {
    n: "03",
    title: "Reproduce",
    body: "Recompute the content hash anywhere. It matches the receipt, or it does not. Agreement is mechanical, not a matter of trust.",
  },
];

/** Slice the `score { … }` block out of a methodology source and locate its `otherwise` line. */
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
  const bench = benchmark();
  const summary = bench.summary;
  const literal = loadExamples().find((example) => example.id === "literal");
  const { code, seamLine } = extractScoreBlock(literal?.source ?? "");

  const sensitiveMembers = bench.cells
    .filter((cell) => cell.sensitive)
    .map((cell) => MEMBER_LABELS[cell.member] ?? cell.member);

  let sampleHash: string | undefined;
  try {
    sampleHash = evaluateMember("japan", "published")?.canonical_hash;
  } catch {
    sampleHash = undefined;
  }

  return (
    <main className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-10%] h-[28rem] w-[28rem] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(circle, var(--indigo) 0%, transparent 70%)" }}
        />
        <div className="mx-auto grid max-w-[76rem] items-start gap-12 px-5 py-20 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16 lg:py-28">
          <div className="flex flex-col">
            <SectionLabel seam className={reveal}>
              Auditable compliance · 2025 G7 commitments
            </SectionLabel>

            <h1
              className={`mt-6 font-serif text-[2.7rem] leading-[1.03] tracking-tight text-balance sm:text-6xl ${reveal}`}
              style={{ animationDelay: "80ms" }}
            >
              <span className="text-gold">&ldquo;</span>up to four strong actions.
              <span className="text-gold">&rdquo;</span>
            </h1>

            <div className={`mt-7 ${reveal}`} style={{ animationDelay: "160ms" }}>
              <Prose>
                Five words in a G7 rubric decide a country&rsquo;s score, and they can be read two
                ways. Covenant is an auditable policy-evaluation compiler: it turns the methodology
                into a program, evaluates it against a frozen, reviewed evidence snapshot with a
                deterministic four-valued engine, and returns a{" "}
                <strong>receipt you can recompute</strong>. Where a score turns on a reading rather
                than a fact, it says so.
              </Prose>
            </div>

            <div
              className={`mt-9 flex flex-wrap items-center gap-3 ${reveal}`}
              style={{ animationDelay: "240ms" }}
            >
              <Button
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
          </div>

          <div className={reveal} style={{ animationDelay: "320ms" }}>
            <CodeArtifact
              label="Literal reading · score program"
              filename="2025-ai-sme-literal.covenant"
              code={code}
              seam={seamLine ? [seamLine] : []}
              caption={
                <div className="flex flex-col gap-2">
                  <span className="label-mono">Witness · the uncovered region</span>
                  <span className="font-mono text-[0.82rem] leading-relaxed">
                    <span className="text-foreground">strong_count 0, weak_count 5</span>
                    <span className="text-ink-faint"> → no rule matches → </span>
                    <TruthBadge value="unresolved" />
                  </span>
                </div>
              }
            />
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
              Read as the range 1&ndash;4, a state with zero strong actions and five weak ones falls
              through every rule. The <span className="font-mono text-[0.82rem]">otherwise</span>{" "}
              clause catches it as unresolved — the gap the analyzer flags before evidence exists.
            </p>
          </div>
        </div>
      </section>

      {/* ── Figures band ─────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-[76rem] grid-cols-2 gap-x-6 gap-y-10 px-5 py-14 sm:px-6 lg:grid-cols-4">
          <Stat
            value={`${summary.matches} / ${summary.cells}`}
            label="Members reproduced"
            sub="Published 2025 AI-for-SMEs scores, recomputed from frozen evidence."
          />
          <Stat
            tone="gold"
            value={summary.interpretation_sensitive_cells}
            label="Interpretation-sensitive"
            sub={`${sensitiveMembers.join(" and ")} hold a published 0 only under a strict reading.`}
          />
          <Stat
            value="130"
            label="Conformance cases"
            sub="Cross-implementation checks that pin the semantics byte for byte."
          />
          <Stat
            value="511"
            label="Tests passing"
            sub="Across the language, evaluator, analyzer, and benchmark packages."
          />
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
        <div className="max-w-2xl">
          <SectionLabel seam>The instrument</SectionLabel>
          <SectionHeading className="mt-4">
            Six stages, each one auditable on its own.
          </SectionHeading>
          <Prose className="mt-4">
            Nothing here is a black box. Every stage produces an artifact you can read — a canonical
            IR, an analyzer verdict, a receipt, a content hash — and hand to someone who disagrees.
          </Prose>
        </div>

        <div className="mt-10 grid grid-cols-1 border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <Link
                key={cap.title}
                href={cap.href}
                className="group relative flex flex-col gap-3.5 border-r border-b border-border p-6 transition-colors hover:bg-surface-2/40 focus-visible:bg-surface-2/40 focus-visible:outline-none"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-8 items-center justify-center rounded-[3px] border border-border text-ink-soft transition-colors group-hover:border-gold/40 group-hover:text-gold">
                    <Icon className="size-4" />
                  </span>
                  <ArrowUpRight className="size-4 -translate-x-1 text-ink-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" />
                </div>
                <h3 className="font-serif text-lg leading-snug tracking-tight">{cap.title}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{cap.body}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Movements ────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Three movements</SectionLabel>
            <SectionHeading className="mt-4">From rubric to receipt.</SectionHeading>
          </div>

          <ol className="mt-12 grid grid-cols-1 gap-px overflow-hidden border-t border-border md:grid-cols-3">
            {MOVEMENTS.map((movement) => (
              <li
                key={movement.n}
                className="relative flex flex-col gap-3 bg-background/40 pt-6 md:px-6 md:pt-8"
              >
                <span aria-hidden className="absolute top-0 left-0 h-px w-10 bg-gold md:left-6" />
                <span className="font-mono text-sm text-gold tabular-nums">{movement.n}</span>
                <h3 className="font-serif text-xl tracking-tight">{movement.title}</h3>
                <p className="max-w-sm text-sm leading-relaxed text-ink-soft">{movement.body}</p>
                {movement.n === "03" && sampleHash ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <HashPill hash={sampleHash} label="canonical_hash" chars={10} />
                    <span className="text-xs text-ink-faint">tamper-evident</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-20 sm:px-6">
          <SectionLabel seam>Try it</SectionLabel>
          <SectionHeading className="max-w-2xl text-3xl sm:text-4xl">
            Watch a rubric that can&rsquo;t decide, decide — in the open.
          </SectionHeading>
          <Prose>
            Load the literal, resolved, and inclusive readings side by side. Compile them, see the
            analyzer catch the gap and the overlap, then evaluate a G7 member and read the receipt.
          </Prose>
          <div className="flex flex-wrap gap-3">
            <Button
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
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/benchmark">See the 2025 benchmark</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
