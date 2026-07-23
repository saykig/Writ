import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import type { Diagnostic } from "@covenant/domain";
import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge } from "@/components/site/truth-badge";
import type { TruthBadgeValue } from "@/components/site/truth-badge";
import { analyze, compile, loadExamples } from "@/lib/toolchain";
import { listRepoDir, readRepoText } from "@/lib/repo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methodologies — Covenant",
  description:
    "The checked-in methodology packages: the literal, resolved, and inclusive readings of the 2025 AI-for-SMEs commitment, each compiled to canonical IR and checked by the analyzer, with a DSL syntax reference.",
};

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

const FLAGSHIP_FILES = new Set([
  "2025-ai-sme-literal.covenant",
  "2025-ai-sme-resolved.covenant",
  "2025-ai-sme-inclusive-up-to.covenant",
]);

// The line each reading turns on — where a human reading of the rubric enters.
const SEAM_NEEDLE: Record<string, string> = {
  literal: "otherwise unresolved",
  inclusive: "between {0, 4}",
  resolved: "parameter counteraction_precedence",
};

const OUTCOME: Record<string, { badge: TruthBadgeValue; word: string }> = {
  gap: { badge: "unresolved", word: "gap" },
  overlap: { badge: "contested", word: "overlap" },
  clean: { badge: "true", word: "clean" },
};

function lineOf(source: string, needle: string): number {
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  return index === -1 ? 0 : index + 1;
}

interface IrSummary {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly commitments: number;
  readonly commitmentId: string;
  readonly variables: number;
  readonly parameters: number;
  readonly scoreRules: number;
  readonly assertions: readonly string[];
  readonly actionIdentity: string;
}

function summarize(source: string): { ir?: IrSummary; findings: readonly Diagnostic[] } {
  const compiled = compile(source);
  const findings = analyze(source).findings;
  const ir = compiled.ir;
  if (!ir) return { findings };
  const commitment = ir.commitments[0];
  return {
    findings,
    ir: {
      packageName: ir.package.name,
      packageVersion: ir.package.version,
      commitments: ir.commitments.length,
      commitmentId: commitment?.id ?? "—",
      variables: commitment?.variables.length ?? 0,
      parameters: commitment?.parameters.length ?? 0,
      scoreRules: commitment?.score_program.rules.length ?? 0,
      assertions: commitment?.assertions.map((a) => a.kind) ?? [],
      actionIdentity: commitment?.action_identity.policy ?? "—",
    },
  };
}

function SpecRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt className="label-mono">{term}</dt>
      <dd className="text-right font-mono text-[0.82rem] text-foreground">{children}</dd>
    </div>
  );
}

// ── DSL syntax reference (specs/covenant.ebnf; snippets drawn from examples) ──
const SYNTAX: readonly { name: string; blurb: string; code: string }[] = [
  {
    name: "commitment",
    blurb: "The unit of evaluation: what was promised, its window, and its evidence posture.",
    code: `commitment AI_SME_ADOPTION {
  subjects G7Members;
  evaluation_window [2025-06-18, 2026-06-01];
  evidence_policy open_world;
  unknown_policy propagate;
  …
}`,
  },
  {
    name: "let + query",
    blurb: "A typed binding over a query. count_distinct folds duplicates by an identity key.",
    code: `let strong_count: Int =
  count_distinct(actions
    where classification == strong
    distinct_by underlying_instrument_id);`,
  },
  {
    name: "coverage",
    blurb: "How many declared dimensions or partner classes the actions cover.",
    code: `let dimension_coverage: Int =
  coverage(actions, dimensions);`,
  },
  {
    name: "action_identity",
    blurb: "The policy that decides when two actions are the same countable thing.",
    code: `action_identity review_required
  by underlying_instrument_id, program_family_id;`,
  },
  {
    name: "predicate",
    blurb: "A derived four-valued fact, resolved by priority-ordered rules.",
    code: `predicate targets_smes(a: Action) -> Truth {
  derive true priority 10
    when a.beneficiary_targeting == sme_direct;
}`,
  },
  {
    name: "classify",
    blurb: "Assign a label exclusively or as multiple labels; otherwise names the default.",
    code: `classify strength exclusive {
  label strong priority 20 when funded and durable;
  label weak   priority 10 when announced;
  otherwise weak safe_under_open_world;
}`,
  },
  {
    name: "score",
    blurb: "Prioritized branches to +1 / 0 / -1; otherwise catches every uncovered state.",
    code: `score {
  result "+1" priority 10 when strong_count >= 5 id full;
  result "0"  priority 10 when strong_count between {1, 4} id partial;
  otherwise unresolved "Rule text does not cover this state.";
}`,
  },
  {
    name: "parameter",
    blurb:
      "A governed interpretation knob with a default and an allowed set. A profile supplies it.",
    code: `parameter counteraction_precedence: Bool = true
  allowed {true, false};`,
  },
  {
    name: "assert",
    blurb: "Properties the analyzer proves over declared domains before any evidence exists.",
    code: `assert exhaustive     over strong_count in 0..8;
assert non_overlapping over strong_count in 0..8;`,
  },
  {
    name: "profile",
    blurb: "A named set of parameter values (and diagnostic waivers) for one evaluation run.",
    code: `profile resolved-default for g7.…​.ai_sme.resolved {
  set counteraction_precedence = true;
}`,
  },
];

export default function MethodologiesPage() {
  const examples = loadExamples();

  // The rest of the checked-in corpus, compiled live for a compact index.
  const extraFiles = listRepoDir("examples")
    .filter((f) => f.endsWith(".covenant") && !FLAGSHIP_FILES.has(f))
    .sort();
  const extras = extraFiles.map((file) => {
    const { ir, findings } = summarize(readRepoText(`examples/${file}`));
    return { file, ir, findings };
  });

  return (
    <main className="flex-1">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-24">
          <SectionLabel seam className={reveal}>
            Methodologies
          </SectionLabel>
          <SectionHeading as="h1" className={cn("mt-5 text-4xl sm:text-5xl", reveal)}>
            A rubric, written as a program.
          </SectionHeading>
          <Prose className={cn("mt-6", reveal)}>
            A methodology in the Covenant DSL compiles to a typed, canonical IR — the same rubric,
            made precise enough to analyze and evaluate. The 2025 AI-for-SMEs commitment appears
            here in three readings of one ambiguous phrase, <em>“up to four strong actions,”</em> so
            the ambiguity is visible rather than hidden. Each is compiled and analyzed live, on this
            page.
          </Prose>
        </div>
      </section>

      {/* ── Flagship readings ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto flex max-w-[76rem] flex-col gap-16 px-5 py-20 sm:px-6">
          {examples.map((example) => {
            const { ir, findings } = summarize(example.source);
            const seamLine = lineOf(example.source, SEAM_NEEDLE[example.id] ?? "");
            const outcome = OUTCOME[example.outcome];
            return (
              <article
                key={example.id}
                className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <TruthBadge value={outcome.badge}>{outcome.word}</TruthBadge>
                    <h2 className="font-serif text-2xl tracking-tight">{example.title}</h2>
                    <span className="label-mono">{example.reading}</span>
                  </div>
                  <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
                    {example.note}
                  </p>
                  <CodeArtifact
                    label="Methodology source"
                    filename={`${example.id === "inclusive" ? "2025-ai-sme-inclusive-up-to" : `2025-ai-sme-${example.id}`}.covenant`}
                    code={example.source}
                    seam={seamLine ? [seamLine] : []}
                  />
                </div>

                <div className="flex flex-col gap-6">
                  <div>
                    <p className="label-mono mb-3">Compiled IR</p>
                    <dl className="rounded-[4px] border border-border bg-surface-2/30 px-4 py-2 ring-1 ring-foreground/[0.03]">
                      {ir ? (
                        <>
                          <SpecRow term="package">
                            <span className="text-ink-soft">{ir.packageName}</span>
                          </SpecRow>
                          <SpecRow term="version">{ir.packageVersion}</SpecRow>
                          <SpecRow term="commitments">{ir.commitments}</SpecRow>
                          <SpecRow term="variables">{ir.variables}</SpecRow>
                          <SpecRow term="parameters">
                            {ir.parameters > 0 ? (
                              <span className="text-gold">{ir.parameters}</span>
                            ) : (
                              ir.parameters
                            )}
                          </SpecRow>
                          <SpecRow term="score rules">{ir.scoreRules}</SpecRow>
                          <SpecRow term="action identity">{ir.actionIdentity}</SpecRow>
                          <SpecRow term="assertions">
                            {ir.assertions.length ? ir.assertions.join(", ") : "—"}
                          </SpecRow>
                        </>
                      ) : (
                        <p className="py-2 text-sm text-ink-soft">Did not compile to IR.</p>
                      )}
                    </dl>
                  </div>

                  <div>
                    <p className="label-mono mb-3">Analyzer verdict</p>
                    {findings.length === 0 ? (
                      <div className="flex items-start gap-2.5 rounded-[4px] border border-true/30 bg-true/[0.06] px-4 py-3">
                        <Check className="mt-0.5 size-4 shrink-0 text-true" aria-hidden />
                        <p className="text-sm leading-relaxed text-ink-soft">
                          Total and non-overlapping over the declared domains. No gaps, no unmarked
                          overlaps.
                        </p>
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {findings.map((f, i) => (
                          <li
                            key={`${f.code}-${i}`}
                            className="rounded-[4px] border border-gold/35 bg-gold-wash px-3.5 py-2.5"
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-[3px] border border-gold/45 bg-background/40 px-1.5 py-0.5 font-mono text-[0.68rem] text-gold">
                                {f.code}
                              </span>
                              <span className="label-mono">{f.severity}</span>
                            </div>
                            <p className="text-[0.82rem] leading-relaxed text-ink-soft">
                              {f.message}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Rest of the corpus ────────────────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>The rest of the 2025 corpus</SectionLabel>
            <SectionHeading className="mt-4">
              Other rubric shapes, compiled the same way.
            </SectionHeading>
            <Prose className="mt-4">
              Beyond the AI-for-SMEs readings, the corpus encodes other 2025 chapters — dimensional
              coverage, partner-class breadth, artifact completeness. Each is listed straight from{" "}
              <span className="font-mono text-[0.82rem]">examples/</span>, compiled on this request.
            </Prose>
          </div>

          <div className="mt-10 overflow-x-auto rounded-[4px] border border-border ring-1 ring-foreground/[0.03]">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-left">
                  <th className="label-mono px-4 py-2.5 font-normal">File</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Package</th>
                  <th className="label-mono px-4 py-2.5 text-right font-normal">Rules</th>
                  <th className="label-mono px-4 py-2.5 font-normal">Analyzer</th>
                </tr>
              </thead>
              <tbody>
                {extras.map((row) => {
                  const codes = Array.from(new Set(row.findings.map((f) => f.code)));
                  return (
                    <tr key={row.file} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-mono text-[0.78rem] whitespace-nowrap text-foreground">
                        {row.file}
                      </td>
                      <td className="px-4 py-3 font-mono text-[0.76rem] text-ink-soft">
                        {row.ir?.packageName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[0.82rem] tabular-nums">
                        {row.ir?.scoreRules ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {codes.length === 0 ? (
                          <span className="font-mono text-[0.72rem] text-true">clean</span>
                        ) : (
                          <span className="font-mono text-[0.72rem] text-gold">
                            {codes.join(", ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── DSL reference ─────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>DSL reference</SectionLabel>
            <SectionHeading className="mt-4">The surface, in ten forms.</SectionHeading>
            <Prose className="mt-4">
              The grammar is the design target in{" "}
              <span className="font-mono text-[0.82rem]">specs/covenant.ebnf</span>. A methodology
              is a header, some sources and types, and one or more commitments; a commitment binds
              queried variables, classifies and derives facts, then scores and asserts.
            </Prose>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden border-t border-l border-border sm:grid-cols-2">
            {SYNTAX.map((entry) => (
              <div
                key={entry.name}
                className="flex flex-col gap-3 border-r border-b border-border p-5"
              >
                <div>
                  <code className="font-mono text-[0.82rem] font-medium text-gold">
                    {entry.name}
                  </code>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{entry.blurb}</p>
                </div>
                <pre className="overflow-x-auto rounded-[3px] border border-border/70 bg-surface-2/40 px-3 py-2.5 font-mono text-[0.72rem] leading-[1.55] text-foreground/90">
                  <code>{entry.code}</code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-20 sm:px-6">
          <SectionLabel seam>Run one</SectionLabel>
          <SectionHeading className="max-w-2xl text-3xl sm:text-4xl">
            Compile these readings, then score a member against frozen evidence.
          </SectionHeading>
          <Prose>
            The playground loads all three readings side by side: compile them, watch the analyzer
            catch the gap and the overlap, then evaluate a G7 member and read the receipt.
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
              render={<Link href="/how-it-works">How it works</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
