import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HashPill } from "@/components/site/hash-pill";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge } from "@/components/site/truth-badge";
import type { TruthBadgeValue } from "@/components/site/truth-badge";
import { ArchitectureDiagram } from "@/components/how-it-works/architecture-diagram";
import { evaluateMember, verify } from "@/lib/toolchain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works — Covenant",
  description:
    "The architecture and semantics end to end: a four-valued truth lattice, the source → canonical IR → evaluator → receipt pipeline, open-world evidence where unknown is never silently false, and content-addressed provenance.",
};

const reveal =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-both motion-safe:duration-700";

// ── The four-valued lattice (04_FORMAL_SEMANTICS.md §2) ──────────────────────
const TRUTH_VALUES: readonly {
  value: TruthBadgeValue;
  pair: string;
  name: string;
  gloss: string;
}[] = [
  { value: "true", pair: "(1, 0)", name: "true", gloss: "Support for truth, none for falsity." },
  { value: "false", pair: "(0, 1)", name: "false", gloss: "Support for falsity, none for truth." },
  {
    value: "unknown",
    pair: "(0, 0)",
    name: "unknown",
    gloss: "No support either way. Absence of evidence.",
  },
  {
    value: "contested",
    pair: "(1, 1)",
    name: "contested",
    gloss: "Support for both. Accepted evidence conflicts.",
  },
];

const ORDER: readonly TruthBadgeValue[] = ["true", "false", "unknown", "contested"];

// AND / OR tables, row-major in ORDER (§2.2, §2.3).
const AND_TABLE: readonly (readonly TruthBadgeValue[])[] = [
  ["true", "false", "unknown", "contested"],
  ["false", "false", "false", "false"],
  ["unknown", "false", "unknown", "false"],
  ["contested", "false", "false", "contested"],
];
const OR_TABLE: readonly (readonly TruthBadgeValue[])[] = [
  ["true", "true", "true", "true"],
  ["true", "false", "unknown", "contested"],
  ["true", "unknown", "unknown", "true"],
  ["true", "contested", "true", "contested"],
];

const NEGATION: readonly { from: TruthBadgeValue; to: TruthBadgeValue }[] = [
  { from: "true", to: "false" },
  { from: "false", to: "true" },
  { from: "unknown", to: "unknown" },
  { from: "contested", to: "contested" },
];

function TruthTable({ op, table }: { op: string; table: readonly (readonly TruthBadgeValue[])[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left">
              <span className="font-mono text-xs text-ink-faint">{op}</span>
            </th>
            {ORDER.map((col) => (
              <th key={col} className="px-2 py-1.5">
                <TruthBadge value={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr key={ORDER[i]}>
              <th className="px-2 py-1.5 text-left">
                <TruthBadge value={ORDER[i]} />
              </th>
              {row.map((cell, j) => (
                <td key={`${i}-${j}`} className="px-2 py-1.5 text-center">
                  <TruthBadge value={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const OPEN_WORLD_EXITS = [
  "the predicate is derived from a complete enumerated domain;",
  "an explicit negative claim is accepted;",
  "a methodology declares a closed-world subdomain;",
  "a reviewed negative-search protocol satisfies a declared completeness requirement.",
];

const CANON_STEPS = [
  "validate against the versioned JSON Schema;",
  "normalize Unicode to NFC where permitted;",
  "serialize exact decimals as canonical strings;",
  "sort object keys with RFC 8785 canonical JSON;",
  "preserve ordered lists where order is meaningful;",
  "exclude transport-only fields declared non-semantic.",
];

export default function HowItWorksPage() {
  let sampleHash: string | undefined;
  let verified = false;
  try {
    const receipt = evaluateMember("japan", "published");
    sampleHash = receipt?.canonical_hash;
    if (receipt) verified = verify(receipt).valid;
  } catch {
    sampleHash = undefined;
  }

  return (
    <main className="flex-1">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-16 sm:px-6 sm:py-24">
          <SectionLabel seam className={reveal}>
            How it works
          </SectionLabel>
          <SectionHeading as="h1" className={cn("mt-5 text-4xl sm:text-5xl", reveal)}>
            The architecture, and the semantics beneath it.
          </SectionHeading>
          <Prose className={cn("mt-6", reveal)}>
            Covenant is a pipeline with a lattice at its center. A methodology compiles to a
            canonical IR; a deterministic engine scores a subject over frozen evidence using four
            truth values rather than two; and every result carries a proof tree and content hashes
            anyone can recompute. Nothing is a black box, because every stage leaves an artifact.
          </Prose>
        </div>
      </section>

      {/* ── Four-valued truth ─────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Four-valued truth</SectionLabel>
            <SectionHeading className="mt-4">
              Two values cannot tell &ldquo;no&rdquo; from &ldquo;we do not know.&rdquo;
            </SectionHeading>
            <Prose className="mt-4">
              Covenant uses a Belnap support pair: an independent bit for support of truth and
              support of falsity. That single distinction separates absence of evidence from
              conflicting evidence — the difference between a country that did nothing and one whose
              record is disputed.
            </Prose>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden border-t border-l border-border sm:grid-cols-2 lg:grid-cols-4">
            {TRUTH_VALUES.map((t) => (
              <div
                key={t.value}
                className="flex flex-col gap-3 border-r border-b border-border p-5"
              >
                <div className="flex items-center justify-between">
                  <TruthBadge value={t.value} />
                  <span className="font-mono text-sm text-ink-faint tabular-nums">{t.pair}</span>
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">{t.gloss}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[auto_auto_1fr] lg:items-start lg:gap-12">
            <div>
              <p className="label-mono mb-3">Conjunction</p>
              <TruthTable op="and" table={AND_TABLE} />
            </div>
            <div>
              <p className="label-mono mb-3">Disjunction</p>
              <TruthTable op="or" table={OR_TABLE} />
            </div>
            <div className="max-w-sm">
              <p className="label-mono mb-3">Negation swaps the support pair</p>
              <div className="flex flex-col gap-2">
                {NEGATION.map((n) => (
                  <div key={n.from} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-ink-faint">not</span>
                    <TruthBadge value={n.from} />
                    <span className="text-ink-faint">=</span>
                    <TruthBadge value={n.to} />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                A comparison over known, uncontested values returns <TruthBadge value="true" /> or{" "}
                <TruthBadge value="false" />. An empty{" "}
                <span className="font-mono text-xs">forall</span> is vacuously true; an empty{" "}
                <span className="font-mono text-xs">exists</span> is false.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pipeline / architecture ───────────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>The pipeline</SectionLabel>
            <SectionHeading className="mt-4">
              Source → canonical IR → evaluator → receipt.
            </SectionHeading>
            <Prose className="mt-4">
              Two governed lanes converge. A methodology becomes a typed IR the analyzer can prove
              total; evidence becomes a frozen, hash-pinned snapshot. The evaluator reads both — and
              only both — and emits a receipt. It performs no network access, reads no clock, and
              draws no randomness, so the same inputs always yield the same bytes.
            </Prose>
          </div>
          <div className="mt-10">
            <ArchitectureDiagram />
          </div>
        </div>
      </section>

      {/* ── Open-world evidence ───────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <SectionLabel seam>Open-world evidence</SectionLabel>
              <SectionHeading className="mt-4">Unknown is never silently false.</SectionHeading>
              <Prose className="mt-4">
                Public-source research is open-world: a missing record is not proof that an action
                did not happen. A predicate with no supporting evidence is{" "}
                <TruthBadge value="unknown" />, and it stays unknown as it propagates. A score is
                never lowered merely because a higher branch is unknown — the receipt returns{" "}
                <em>unresolved</em> and names the decisive uncertainty instead.
              </Prose>
            </div>
            <div className="lg:pt-2">
              <p className="label-mono mb-4">Absence becomes false only when</p>
              <ul className="flex flex-col gap-3 border-t border-border pt-4">
                {OPEN_WORLD_EXITS.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                    <span aria-hidden className="mt-[0.5rem] h-px w-4 shrink-0 bg-gold" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                Each is an explicit, declared exit from open-world reasoning — never a silent
                default.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Content-addressed provenance ──────────────────────────────────── */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-[76rem] px-5 py-20 sm:px-6">
          <div className="max-w-2xl">
            <SectionLabel seam>Content-addressed provenance</SectionLabel>
            <SectionHeading className="mt-4">
              Agreement is mechanical, not a matter of trust.
            </SectionHeading>
            <Prose className="mt-4">
              Before anything is hashed it is canonicalized, so the hash depends on meaning, not
              formatting. A receipt binds five hashes: the methodology bundle, the evidence
              snapshot, the interpretation profile, the evaluator build, and the receipt&rsquo;s own
              canonical hash. Recompute any of them anywhere — it matches the receipt, or it does
              not.
            </Prose>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div>
              <p className="label-mono mb-4">Canonicalization, before hashing</p>
              <ol className="flex flex-col gap-2.5 border-t border-border pt-4">
                {CANON_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                    <span className="font-mono text-xs text-gold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-4">
              <p className="label-mono">A real receipt, recomputed on this request</p>
              <div className="rounded-[5px] border border-border bg-surface-2/40 p-5 ring-1 ring-foreground/[0.03]">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Evaluating the resolved methodology against Japan&rsquo;s frozen 2025 snapshot
                  produces this receipt hash. Its self-describing{" "}
                  <span className="font-mono text-[0.82rem]">canonical_hash</span> verifies against
                  the receipt body.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {sampleHash ? (
                    <>
                      <HashPill hash={sampleHash} label="canonical_hash" chars={12} />
                      {verified ? (
                        <span className="font-mono text-[0.72rem] text-true">verified ✓</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-mono text-[0.72rem] text-ink-faint">
                      snapshot unavailable in this environment
                    </span>
                  )}
                </div>
                <p className="mt-4 font-mono text-[0.68rem] leading-relaxed text-ink-faint">
                  Same bundle · same snapshot · same evaluator build → byte-identical receipt.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-20 sm:px-6">
          <SectionLabel seam>Follow it through</SectionLabel>
          <SectionHeading className="max-w-2xl text-3xl sm:text-4xl">
            Read the rubric, the ledger, and the corpus that pins them.
          </SectionHeading>
          <Prose>
            The three governed layers each have their own page: the methodologies compiled to IR,
            the governed evidence ledger, and the implementation-independent conformance suite.
          </Prose>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              nativeButton={false}
              render={
                <Link href="/methodologies">
                  Read the methodologies
                  <ArrowRight />
                </Link>
              }
            />
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/governance">The governed ledger</Link>}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
