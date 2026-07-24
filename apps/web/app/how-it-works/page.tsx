import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { Diagnostic } from "@writ/domain";
import { Button } from "@/components/ui/button";
import { CodeArtifact } from "@/components/site/code-artifact";
import { HashPill } from "@/components/site/hash-pill";
import { PageHeader } from "@/components/site/page-header";
import { Prose, SectionHeading, SectionLabel } from "@/components/site/section";
import { TruthBadge } from "@/components/site/truth-badge";
import type { TruthBadgeValue } from "@/components/site/truth-badge";
import { ArchitectureDiagram } from "@/components/how-it-works/architecture-diagram";
import { EssayIndex, type EssaySection } from "@/components/how-it-works/essay-index";
import { Faq } from "@/components/how-it-works/faq";
import { GITHUB_URL } from "@/components/site/nav-items";
import { loadCoverage } from "@/lib/conformance";
import { analyze, compile, evaluateMember, exampleSource, verify } from "@/lib/toolchain";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works · Writ",
  description:
    "One reading of the whole path: the source to canonical IR to evaluator to receipt pipeline, a four-valued truth lattice where unknown is never silently false, the Writ language compiled live, the governed evidence ledger, and the implementation-independent conformance corpus.",
};

// The five movements of the essay, in reading order. Their ids anchor the
// sticky index and the in-text cross-references.
const SECTIONS: readonly EssaySection[] = [
  { id: "pipeline", title: "The pipeline" },
  { id: "truth", title: "Four-valued truth" },
  { id: "language", title: "The language" },
  { id: "evidence", title: "Governed evidence" },
  { id: "conformance", title: "Conformance" },
  { id: "faq", title: "Questions" },
];

// ── Four-valued kernel (04_FORMAL_SEMANTICS.md §2) ───────────────────────────
const ORDER: readonly TruthBadgeValue[] = ["true", "false", "unknown", "contested"];

const TRUTH_VALUES: readonly { value: TruthBadgeValue; pair: string; gloss: string }[] = [
  { value: "true", pair: "(1, 0)", gloss: "Support for truth, none for falsity." },
  { value: "false", pair: "(0, 1)", gloss: "Support for falsity, none for truth." },
  { value: "unknown", pair: "(0, 0)", gloss: "No support either way. Absence of evidence." },
  { value: "contested", pair: "(1, 1)", gloss: "Support for both. Accepted evidence conflicts." },
];

// One table is enough: conjunction, row-major in ORDER (§2.2). Disjunction is
// its dual and negation simply swaps the support pair.
const AND_TABLE: readonly (readonly TruthBadgeValue[])[] = [
  ["true", "false", "unknown", "contested"],
  ["false", "false", "false", "false"],
  ["unknown", "false", "unknown", "false"],
  ["contested", "false", "false", "contested"],
];

const OPEN_WORLD_EXITS: readonly string[] = [
  "the predicate is derived from a complete, enumerated domain;",
  "an explicit negative claim is accepted into evidence;",
  "a methodology declares a closed-world subdomain;",
  "a reviewed negative-search protocol satisfies a declared completeness requirement.",
];

// ── The language surface, in brief (specs/writ.ebnf) ─────────────────────
const FORMS: readonly { keyword: string; gloss: string }[] = [
  {
    keyword: "commitment",
    gloss: "The unit of evaluation: what was promised, its window, its evidence posture.",
  },
  {
    keyword: "let … count_distinct",
    gloss: "A typed binding over a query; folds duplicate actions by an identity key.",
  },
  {
    keyword: "predicate",
    gloss: "A derived four-valued fact, resolved by priority-ordered rules.",
  },
  {
    keyword: "classify",
    gloss: "Assigns a label exclusively or as several; otherwise names the default.",
  },
  {
    keyword: "score",
    gloss: "Prioritized branches to +1 / 0 / -1; otherwise catches every uncovered state.",
  },
  {
    keyword: "parameter",
    gloss: "A governed interpretation knob with a default and an allowed set.",
  },
  {
    keyword: "assert",
    gloss: "Properties the analyzer proves over declared domains before evidence exists.",
  },
];

// Two real excerpts of the checked-in literal reading, compiled live below.
const QUERY_SNIPPET = `let strong_count: Int =
  count_distinct(actions where classification == strong
    distinct_by underlying_instrument_id);

let weak_count: Int =
  count_distinct(actions where classification == weak
    distinct_by underlying_instrument_id);

let counter_exists: Truth =
  exists(actions where classification == counter);`;

const SCORE_SNIPPET = `score {
  result "+1" priority 10 when strong_count >= 5 id full;
  result "0" priority 10 when (strong_count between {1, 4}) or
    (strong_count == 0 and weak_count between {3, 4}) id partial;
  result "-1" priority 10 when counter_exists or
    (strong_count == 0 and weak_count <= 2) id none;
  otherwise unresolved "The published rule text does not cover this state.";
}`;
// The line the whole reading turns on: the uncovered state left to `otherwise`.
const SCORE_SEAM = [7];

// ── Governed command surface, verbatim from apps/api/src/http/app.ts ─────────
interface Endpoint {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly purpose: string;
  readonly roles: string;
}
const ENDPOINTS: readonly Endpoint[] = [
  { method: "GET", path: "/health", purpose: "Liveness probe.", roles: "public" },
  { method: "POST", path: "/v1/claims", purpose: "Mint a candidate claim.", roles: "any writer" },
  {
    method: "POST",
    path: "/v1/claims/:id/submit",
    purpose: "Submit a candidate for review.",
    roles: "author +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/accept",
    purpose: "Accept a candidate; separation of duties enforced.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/reject",
    purpose: "Reject a candidate or contested claim.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/contest",
    purpose: "Mark a claim disputed, short of rejection.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/claims/:id/supersede",
    purpose: "Replace an accepted claim with a new accepted row.",
    roles: "reviewer +",
  },
  { method: "POST", path: "/v1/actions", purpose: "Mint a candidate action.", roles: "any writer" },
  {
    method: "POST",
    path: "/v1/actions/:id/submit",
    purpose: "Submit a candidate action for review.",
    roles: "author +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/accept",
    purpose: "Accept a candidate action.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/reject",
    purpose: "Reject a candidate or contested action.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/contest",
    purpose: "Mark an action disputed.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/actions/:id/supersede",
    purpose: "Replace an accepted action with a new accepted row.",
    roles: "reviewer +",
  },
  {
    method: "POST",
    path: "/v1/snapshots/freeze",
    purpose: "Freeze score-eligible evidence into an immutable snapshot.",
    roles: "admin",
  },
  {
    method: "GET",
    path: "/v1/snapshots/:id/export",
    purpose: "Re-materialize a snapshot and verify its content hash.",
    roles: "authenticated",
  },
];

const LAYERS: readonly { n: string; name: string; body: string }[] = [
  {
    n: "01",
    name: "Normative methodology",
    body: "What was promised, by whom, under which definitions, during what window, and under which scoring rule. A compiled, versioned bundle, not prose.",
  },
  {
    n: "02",
    name: "Reviewed evidence",
    body: "What public actions occurred and which sources support them. A candidate becomes a fact only through review, and only an admin freezes it into a snapshot.",
  },
  {
    n: "03",
    name: "Deterministic receipt",
    body: "The mechanical derivation from frozen evidence and a versioned interpretation profile to a score, or to an unresolved result. A report is a view over these layers, never their source.",
  },
];

// ── Small server-side helpers ────────────────────────────────────────────────
interface IrSummary {
  readonly packageName: string;
  readonly version: string;
  readonly variables: number;
  readonly parameters: number;
  readonly scoreRules: number;
  readonly assertions: readonly string[];
  readonly actionIdentity: string;
}

function summarizeLiteral(source: string): { ir?: IrSummary; findings: readonly Diagnostic[] } {
  const compiled = compile(source);
  const findings = analyze(source).findings;
  const ir = compiled.ir;
  if (!ir) return { findings };
  const commitment = ir.commitments[0];
  return {
    findings,
    ir: {
      packageName: ir.package.name,
      version: ir.package.version,
      variables: commitment?.variables.length ?? 0,
      parameters: commitment?.parameters.length ?? 0,
      scoreRules: commitment?.score_program.rules.length ?? 0,
      assertions: commitment?.assertions.map((a) => a.kind) ?? [],
      actionIdentity: commitment?.action_identity.policy ?? "none",
    },
  };
}

function SpecRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-2 last:border-0">
      <dt className="label-mono">{term}</dt>
      <dd className="text-right font-mono text-[0.8rem] text-foreground">{children}</dd>
    </div>
  );
}

/** A native progressive-disclosure block in the paper palette; never a modal. */
function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="mt-6 overflow-hidden rounded-[7px] border border-rule bg-paper-bright/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[0.82rem] text-ink-soft transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className="shrink-0 text-ink-faint transition-transform duration-200 in-[details[open]]:rotate-180"
        >
          <path
            d="M3.5 5.25 7 8.75l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="border-t border-rule/70 px-4 py-4">{children}</div>
    </details>
  );
}

export default function HowItWorksPage() {
  // Section 3: compile the real literal reading on this request.
  const literalSource = exampleSource("literal") ?? "";
  const { ir, findings } = summarizeLiteral(literalSource);

  // Section 1: a real receipt hash, recomputed and verified now.
  let sampleHash: string | undefined;
  let verified = false;
  try {
    const receipt = evaluateMember("japan", "published");
    sampleHash = receipt?.canonical_hash;
    if (receipt) verified = verify(receipt).valid;
  } catch {
    sampleHash = undefined;
  }

  // Section 5: coverage counted from the corpus files.
  const { areas, totalCases, totalFiles } = loadCoverage();
  const maxCases = Math.max(...areas.map((a) => a.cases));

  return (
    <main className="flex-1">
      <PageHeader
        eyebrow="How it works"
        title="From methodology to reproducible assessment."
        description="Policy researchers can follow the complete path from prose rules and reviewed evidence to a deterministic receipt, with the technical machinery available when needed."
      />
      <article className="mx-auto w-[min(100%-2.5rem,72rem)] pt-14 pb-24 sm:pt-20">
        {/* ── Reading layout: sticky rail + measured column ─────────────────── */}
        <div className="mt-14 grid grid-cols-1 gap-y-4 min-[900px]:grid-cols-[220px_minmax(0,1fr)] min-[900px]:gap-x-16 sm:mt-20">
          <EssayIndex
            sections={SECTIONS}
            note="A reading of the pipeline, its logic, its language, and the evidence and corpus that hold it."
            updated="July 2026"
          />

          <div className="min-w-0">
            {/* ── 1 · The pipeline ────────────────────────────────────────── */}
            <section id="pipeline" className="scroll-mt-24">
              <SectionLabel>The pipeline</SectionLabel>
              <SectionHeading className="mt-3 max-w-[24ch]">
                Source, to canonical IR, to evaluator, to receipt.
              </SectionHeading>
              <Prose className="mt-5">
                Two governed lanes converge. A methodology becomes a typed IR the analyzer can prove
                total; evidence becomes a frozen, hash-pinned snapshot. The evaluator reads both,
                and only both, then emits a receipt. It performs no network access, reads no clock,
                and draws no randomness, so the same inputs always yield the same bytes. Before
                anything is hashed it is canonicalized, so the hash depends on meaning, not
                formatting.
              </Prose>

              <div className="mt-8">
                <ArchitectureDiagram />
              </div>

              <div className="mt-6 flex flex-col gap-4 rounded-[9px] border border-rule bg-paper-raise px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-prose text-[0.9rem] leading-relaxed text-ink-soft">
                  A receipt binds five hashes: the methodology bundle, the evidence snapshot, the
                  interpretation profile, the evaluator build, and its own canonical hash. Recompute
                  any of them anywhere, and it matches the receipt or it does not.
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  {sampleHash ? (
                    <>
                      <HashPill hash={sampleHash} label="canonical_hash" chars={10} />
                      {verified ? (
                        <span className="font-mono text-[0.7rem] text-true">verified ✓</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-mono text-[0.7rem] text-ink-faint">
                      snapshot unavailable here
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* ── 2 · Four-valued truth ───────────────────────────────────── */}
            <section
              id="truth"
              className="mt-20 scroll-mt-24 border-t border-rule-soft pt-16 sm:mt-24 sm:pt-20"
            >
              <SectionLabel>Four-valued truth</SectionLabel>
              <SectionHeading className="mt-3 max-w-[26ch]">
                Two values cannot tell no from we do not know.
              </SectionHeading>
              <Prose className="mt-5">
                Writ scores over a Belnap support pair: one bit for support of truth, one for
                support of falsity. That single distinction separates absence of evidence from
                conflicting evidence, the difference between a country that did nothing and one
                whose record is disputed.
              </Prose>

              <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
                {TRUTH_VALUES.map((t) => (
                  <div
                    key={t.value}
                    className="flex items-baseline gap-3 border-b border-rule-soft pb-3"
                  >
                    <dt className="flex shrink-0 items-center gap-2">
                      <TruthBadge value={t.value} />
                      <span className="font-mono text-[0.72rem] text-ink-faint tabular-nums">
                        {t.pair}
                      </span>
                    </dt>
                    <dd className="text-[0.86rem] leading-snug text-ink-soft">{t.gloss}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-12">
                <figure className="w-fit">
                  <p className="label-mono mb-3">Conjunction</p>
                  <div className="overflow-x-auto">
                    <table className="border-collapse">
                      <thead>
                        <tr>
                          <th className="px-2.5 py-1.5 text-left">
                            <span className="font-mono text-xs text-ink-faint">and</span>
                          </th>
                          {ORDER.map((col) => (
                            <th key={col} className="px-2.5 py-1.5">
                              <TruthBadge value={col} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {AND_TABLE.map((row, i) => (
                          <tr key={ORDER[i]}>
                            <th className="px-2.5 py-1.5 text-left">
                              <TruthBadge value={ORDER[i]!} />
                            </th>
                            {row.map((cell, j) => (
                              <td key={`${i}-${j}`} className="px-2.5 py-1.5 text-center">
                                <TruthBadge value={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <figcaption className="mt-3 max-w-[34ch] text-[0.8rem] leading-relaxed text-ink-muted">
                    Disjunction is the dual of this table; negation swaps the support pair, so
                    unknown and contested are each their own opposite.
                  </figcaption>
                </figure>

                <div className="lg:pt-1">
                  <p className="font-serif text-lg leading-snug text-foreground">
                    Unknown is never silently false.
                  </p>
                  <Prose className="mt-3 text-[0.95rem]">
                    Public-source research is open-world: a missing record is not proof that an
                    action did not happen. A predicate with no supporting evidence is{" "}
                    <TruthBadge value="unknown" />, and it stays unknown as it propagates. A score
                    is never lowered merely because a higher branch is unknown. The receipt returns
                    an unresolved result and names the decisive uncertainty instead.
                  </Prose>
                  <Disclosure summary="When does absence become false?">
                    <ol className="flex flex-col gap-2.5">
                      {OPEN_WORLD_EXITS.map((item, i) => (
                        <li
                          key={item}
                          className="flex gap-3 text-[0.86rem] leading-relaxed text-ink-soft"
                        >
                          <span className="font-mono text-[0.72rem] text-ink-faint tabular-nums">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-muted">
                      Each is an explicit, declared exit from open-world reasoning, never a silent
                      default.
                    </p>
                  </Disclosure>
                </div>
              </div>
            </section>

            {/* ── 3 · The language ────────────────────────────────────────── */}
            <section
              id="language"
              className="mt-20 scroll-mt-24 border-t border-rule-soft pt-16 sm:mt-24 sm:pt-20"
            >
              <SectionLabel>The language</SectionLabel>
              <SectionHeading className="mt-3 max-w-[22ch]">
                A rubric, written as a program.
              </SectionHeading>
              <Prose className="mt-5">
                A methodology in the Writ DSL compiles to a typed, canonical IR: the same rubric,
                made precise enough to analyze and evaluate. The flagship 2025 AI-for-SMEs
                commitment appears in three readings of one ambiguous phrase,{" "}
                <em>up to four strong actions</em>, so the ambiguity is visible rather than hidden.
                Below is the literal reading, compiled on this request.
              </Prose>

              <dl className="mt-8 grid grid-cols-1 border-t border-rule-soft sm:grid-cols-2">
                {FORMS.map((form) => (
                  <div
                    key={form.keyword}
                    className="flex flex-col gap-1 border-b border-rule-soft py-3 sm:odd:pr-8 sm:even:border-l sm:even:border-l-rule-soft sm:even:pl-8"
                  >
                    <dt>
                      <code className="font-mono text-[0.8rem] font-medium text-foreground">
                        {form.keyword}
                      </code>
                    </dt>
                    <dd className="text-[0.86rem] leading-snug text-ink-soft">{form.gloss}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12">
                <div className="flex min-w-0 flex-col gap-5">
                  <CodeArtifact
                    label="Queried variables"
                    filename="2025-ai-sme-literal.writ"
                    code={QUERY_SNIPPET}
                  />
                  <CodeArtifact
                    label="Score program"
                    filename="2025-ai-sme-literal.writ"
                    code={SCORE_SNIPPET}
                    seam={SCORE_SEAM}
                    caption={
                      <span>
                        With zero strong actions and five weak, no result rule matches. The literal
                        reading leaves that state to <code>otherwise unresolved</code>, and the
                        analyzer reports it before any evidence is scored.
                      </span>
                    }
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-6">
                  <div>
                    <p className="label-mono mb-3">Compiled IR</p>
                    <dl className="rounded-[7px] border border-rule bg-paper-raise px-4 py-2">
                      {ir ? (
                        <>
                          <SpecRow term="package">
                            <span className="text-ink-soft">{ir.packageName}</span>
                          </SpecRow>
                          <SpecRow term="version">{ir.version}</SpecRow>
                          <SpecRow term="variables">{ir.variables}</SpecRow>
                          <SpecRow term="parameters">{ir.parameters}</SpecRow>
                          <SpecRow term="score rules">{ir.scoreRules}</SpecRow>
                          <SpecRow term="action identity">{ir.actionIdentity}</SpecRow>
                          <SpecRow term="assertions">
                            {ir.assertions.length ? ir.assertions.join(", ") : "none"}
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
                      <div className="rounded-[7px] border border-true/30 bg-true/[0.06] px-4 py-3 text-sm leading-relaxed text-ink-soft">
                        Total and non-overlapping over the declared domains.
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {findings.map((f, i) => (
                          <li
                            key={`${f.code}-${i}`}
                            className="rounded-[7px] border border-gold/35 bg-gold-wash px-4 py-3"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-[3px] border border-gold/45 bg-paper/50 px-1.5 py-0.5 font-mono text-[0.68rem] text-gold">
                                {f.code}
                              </span>
                              <span className="label-mono">{f.severity}</span>
                            </div>
                            <p className="text-[0.84rem] leading-relaxed text-ink-soft">
                              {f.message}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-[0.82rem] leading-relaxed text-ink-muted">
                      The resolved reading makes the interpretation explicit, with counteraction
                      precedence stated as a governed parameter; the analyzer then reports it clean.
                      Compile all three side by side in the{" "}
                      <Link
                        href="/playground"
                        className="text-foreground underline decoration-gold/45 underline-offset-4 hover:text-gold hover:decoration-gold"
                      >
                        playground
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 4 · Governed evidence ───────────────────────────────────── */}
            <section
              id="evidence"
              className="mt-20 scroll-mt-24 border-t border-rule-soft pt-16 sm:mt-24 sm:pt-20"
            >
              <SectionLabel>Governed evidence</SectionLabel>
              <SectionHeading className="mt-3 max-w-[26ch]">
                A score is only as trustworthy as the evidence beneath it.
              </SectionHeading>
              <Prose className="mt-5">
                Writ separates the path from an international commitment to a compliance judgment
                into three governed layers, each with a role boundary, a content hash, and an
                append-only history. The methodology does not pretend interpretation is mechanical,
                and it does not hide analyst judgment inside prose or a model prompt. A disagreement
                can then be located precisely.
              </Prose>

              <ol className="mt-8 grid grid-cols-1 gap-x-10 md:grid-cols-3">
                {LAYERS.map((layer) => (
                  <li
                    key={layer.n}
                    className="flex flex-col gap-2 border-t border-rule py-4 md:border-t-0 md:border-l md:border-l-rule md:py-0 md:pl-5 md:first:border-l-0 md:first:pl-0"
                  >
                    <span className="font-mono text-[0.78rem] text-ink-faint tabular-nums">
                      {layer.n}
                    </span>
                    <h3 className="font-serif text-lg tracking-tight text-foreground">
                      {layer.name}
                    </h3>
                    <p className="text-[0.86rem] leading-relaxed text-ink-soft">{layer.body}</p>
                  </li>
                ))}
              </ol>

              <Prose className="mt-8">
                Authority is scoped to the bearer token and never trusts the request body. What an
                actor may do is decided by role; whether it may decide a particular object is
                decided by separation of duties, since the author or submitter of evidence may not
                review it. A model actor can create candidates and nothing else. Every transition
                emits one immutable event, hashed together with the prior event, so any gap or
                reordering is detectable, and accepted records are superseded rather than edited in
                place.
              </Prose>

              <Disclosure summary="The command surface: fifteen endpoints, every mutation a command">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[42rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-rule text-left">
                        <th className="label-mono px-3 py-2 font-normal">Method</th>
                        <th className="label-mono px-3 py-2 font-normal">Path</th>
                        <th className="label-mono px-3 py-2 font-normal">Command</th>
                        <th className="label-mono px-3 py-2 font-normal">Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ENDPOINTS.map((e) => (
                        <tr
                          key={`${e.method} ${e.path}`}
                          className="border-b border-rule-soft last:border-0"
                        >
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "font-mono text-[0.7rem]",
                                e.method === "GET" ? "text-ink-muted" : "text-ink-soft",
                              )}
                            >
                              {e.method}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[0.76rem] whitespace-nowrap text-foreground">
                            {e.path}
                          </td>
                          <td className="px-3 py-2 text-[0.84rem] text-ink-soft">{e.purpose}</td>
                          <td className="px-3 py-2 font-mono text-[0.7rem] whitespace-nowrap text-ink-muted">
                            {e.roles}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-muted">
                  Every mutating command accepts an{" "}
                  <span className="font-mono">Idempotency-Key</span> and an optional{" "}
                  <span className="font-mono">expected_version</span> guard. The write model lives
                  in{" "}
                  <a
                    href={`${GITHUB_URL}/tree/main/apps/api/src/http`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-foreground"
                  >
                    apps/api/src/http
                  </a>
                  .
                </p>
              </Disclosure>
            </section>

            {/* ── 5 · Conformance ─────────────────────────────────────────── */}
            <section
              id="conformance"
              className="mt-20 scroll-mt-24 border-t border-rule-soft pt-16 sm:mt-24 sm:pt-20"
            >
              <SectionLabel>Conformance</SectionLabel>
              <SectionHeading className="mt-3 max-w-[24ch]">
                The corpus, not the engine.
              </SectionHeading>
              <Prose className="mt-5">
                A specification two implementations can read differently is not a specification.
                Writ pins its meaning in an implementation-independent corpus: {totalCases}{" "}
                declarative cases across {areas.length} semantic areas, each a frozen input and the
                exact value the semantics require. The corpus imports nothing and depends on no
                engine; the reference stack is one consumer of it, not part of it. It is
                mutation-tested, so a deliberate fault, a flipped truth-table cell or an unknown
                collapsed to false, is caught rather than passing green.
              </Prose>

              <div className="mt-8 overflow-x-auto rounded-[7px] border border-rule">
                <table className="w-full min-w-[44rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-rule bg-paper-deep/50 text-left">
                      <th className="label-mono px-4 py-2.5 font-normal">Area</th>
                      <th className="label-mono px-4 py-2.5 font-normal">Covers</th>
                      <th className="label-mono px-4 py-2.5 text-right font-normal">Files</th>
                      <th className="label-mono px-4 py-2.5 font-normal">Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area) => (
                      <tr key={area.id} className="border-b border-rule-soft last:border-0">
                        <td className="px-4 py-2.5 font-mono text-[0.8rem] text-foreground">
                          {area.id}
                        </td>
                        <td className="max-w-md px-4 py-2.5 text-[0.84rem] text-ink-soft">
                          {area.covers}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-[0.8rem] text-ink-faint tabular-nums">
                          {area.files}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="w-7 shrink-0 font-mono text-[0.8rem] text-foreground tabular-nums">
                              {area.cases}
                            </span>
                            <span
                              aria-hidden
                              className="h-1 rounded-full bg-ink-soft/25"
                              style={{
                                width: `${(area.cases / maxCases) * 100}%`,
                                minWidth: "0.4rem",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-rule bg-paper-deep/40">
                      <td className="px-4 py-3 font-serif text-[0.95rem] text-foreground">Total</td>
                      <td className="px-4 py-3 text-[0.82rem] text-ink-muted">
                        across {totalFiles} files, consumable by any conformant evaluator
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[0.8rem] tabular-nums text-ink-soft">
                        {totalFiles}
                      </td>
                      <td className="px-4 py-3 font-mono text-[0.8rem] tabular-nums text-foreground">
                        {totalCases}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* ── Questions ───────────────────────────────────────────────── */}
            <section id="faq" className="mt-20 scroll-mt-24 sm:mt-24">
              <SectionLabel>Questions</SectionLabel>
              <SectionHeading className="mt-3 max-w-[24ch]">
                The honest answers, up front.
              </SectionHeading>
              <div className="mt-7 max-w-[62ch]">
                <Faq />
              </div>
            </section>

            {/* ── Closing ─────────────────────────────────────────────────── */}
            <section className="mt-20 scroll-mt-24 border-t border-rule-soft pt-16 sm:mt-24 sm:pt-20">
              <SectionHeading className="max-w-[28ch] text-[length:var(--t-h3)]">
                Nothing here is a black box, because every stage leaves an artifact.
              </SectionHeading>
              <Prose className="mt-5">
                The language catches ambiguity before evidence exists; the ledger governs what
                counts as a fact; the evaluator turns both into a receipt anyone can recompute. Run
                it yourself, or read the ledger the 2025 G7 corpus produced.
              </Prose>
              <div className="mt-7 flex flex-wrap gap-3">
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
                  render={<Link href="/benchmark">See the benchmark</Link>}
                />
              </div>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
