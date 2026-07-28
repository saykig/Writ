"use client";

/**
 * The EU–US AI evaluation policy test, top to bottom.
 *
 * Read in order: the presets that define what can be asked, the two small parts
 * the page repeats, the five sections, and then `PolicyTest`, which is just
 * those five in sequence. Everything the page shows comes from `view`, which
 * the server built from the reviewed YAML annotation table.
 *
 * The reviewers' distinctions are load-bearing and are never merged for
 * display: legal force is not compliance function, adoption/applicability/
 * enforcement stay three fields, a government-scoped duty never becomes a
 * market-wide one, and `unknown` is shown as `unknown`.
 */

import * as React from "react";
import { Check, CornerDownRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HashPill } from "@/components/site/hash-pill";
import { SectionHeading, SectionLabel } from "@/components/site/section";
import { statusLabel } from "@/lib/policy-test-format";
import type {
  EvidenceEntry,
  EvidenceGroup,
  HighlightedEvidence,
  PolicyTestReceipt,
  PolicyTestSummary,
  RuleCheck,
  RuleCondition,
} from "@/lib/policy-test";

export interface PolicyTestView {
  summary: PolicyTestSummary;
  includedScope: string[];
  excludedScope: string[];
  ruleConditions: RuleCondition[];
  highlights: HighlightedEvidence[];
  groups: EvidenceGroup[];
  receipt: PolicyTestReceipt;
}

/* ───────────────────────────── 1 · What can be asked ──────────────────────── */

/**
 * Four questions worth putting to the corpus, each a subset of the headline
 * rule's conditions. Only the first is the rule the reviewers wrote; the others
 * loosen it deliberately, because what appears when a condition is dropped is
 * the clearest way to see what that condition was doing.
 */
export const PRESETS: {
  id: string;
  label: string;
  keys: RuleCheck["key"][];
  takeaway: string;
}[] = [
  {
    id: "reviewed",
    label: "The reviewed rule",
    keys: ["actor", "conduct", "force", "applicability"],
    takeaway:
      "One claim in the whole corpus. No US claim reaches even the second condition, because none places a duty on a market provider.",
  },
  {
    id: "evaluation",
    label: "Any model evaluation",
    keys: ["conduct"],
    takeaway:
      "The US corpus does address model evaluation, in three places. All three are voluntary, and none is aimed at a market provider.",
  },
  {
    id: "provider",
    label: "Binding duties on providers",
    keys: ["actor", "force", "applicability"],
    takeaway:
      "The EU binds providers in ten ways, only one of which is model evaluation. The US binds them in none.",
  },
  {
    id: "binding",
    label: "Any binding duty",
    keys: ["force", "applicability"],
    takeaway:
      "The US does have binding, currently applicable duties. They fall on federal agencies and their vendors, not on the market.",
  },
];

/* ─────────────────────────────── 2 · Small parts ──────────────────────────── */

/**
 * How the corpus narrows, one condition at a time.
 *
 * This is the finding in one picture: the EU column steps down to a single
 * claim, and the US column reaches zero at the first condition and never
 * recovers, because no US claim places a duty on a market provider. Bars are
 * proportional to the largest starting count, so the two jurisdictions are
 * directly comparable.
 */
function Funnel({
  claims,
  conditions,
  activeKeys,
}: {
  claims: EvidenceEntry[];
  conditions: RuleCondition[];
  activeKeys: RuleCheck["key"][];
}) {
  const count = (list: EvidenceEntry[], place: "EU" | "US") =>
    list.filter((claim) => claim.jurisdiction === place).length;

  // Each step keeps only the claims that survived every step before it.
  let surviving = claims;
  const steps = [
    {
      label: "All reviewed claims",
      active: true,
      eu: count(claims, "EU"),
      us: count(claims, "US"),
    },
  ];
  for (const condition of conditions) {
    if (condition.key === null) continue;
    const active = activeKeys.includes(condition.key);
    if (active) {
      surviving = surviving.filter(
        (claim) => claim.checks?.find((check) => check.key === condition.key)?.met,
      );
    }
    steps.push({
      label: `${condition.label}: ${condition.value.toLowerCase()}`,
      active,
      eu: count(surviving, "EU"),
      us: count(surviving, "US"),
    });
  }

  const scale = Math.max(...steps.map((step) => Math.max(step.eu, step.us)), 1);

  return (
    <div className="tool overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-3 border-b border-border px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:gap-x-5">
        <span className="label">Narrowing</span>
        <span className="label text-right">EU</span>
        <span className="label text-right">US</span>
      </div>

      {steps.map((step, index) => (
        <div
          key={step.label}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] sm:gap-x-5",
            index > 0 && "border-t border-border/60",
            !step.active && "opacity-40",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="text-[0.7rem] text-muted-foreground/60">
                ↓
              </span>
            ) : null}
            <span
              className={cn(
                "min-w-0 truncate text-[0.85rem]",
                step.active ? "text-foreground" : "text-muted-foreground line-through",
              )}
            >
              {step.label}
            </span>
          </span>

          {(["eu", "us"] as const).map((place) => {
            const value = step[place];
            return (
              <span key={place} className="flex items-center justify-end gap-2">
                <span
                  aria-hidden
                  className={cn(
                    "hidden h-1.5 rounded-full sm:block",
                    value === 0
                      ? "bg-transparent"
                      : place === "eu"
                        ? "bg-primary/60"
                        : "bg-muted-foreground/40",
                  )}
                  style={{ width: `${(value / scale) * 2.5}rem` }}
                />
                <span
                  className={cn(
                    "w-4 text-right text-[0.85rem] tabular-nums",
                    value === 0 ? "text-muted-foreground/50" : "font-medium",
                  )}
                >
                  {value}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Which of the rule's four conditions a claim meets. Glyph, not colour alone. */
function Pips({ checks }: { checks: NonNullable<EvidenceEntry["checks"]> }) {
  const met = checks.filter((check) => check.met).length;
  return (
    <span
      role="img"
      aria-label={`Meets ${met} of ${checks.length}: ${checks
        .map((check) => `${check.label} ${check.met ? "yes" : "no"}`)
        .join(", ")}`}
      className="flex shrink-0 items-center gap-1"
    >
      {checks.map((check) => (
        <span
          key={check.key}
          title={`${check.label}: ${check.actual ?? "not recorded"}`}
          className={cn(
            "flex size-4 items-center justify-center rounded-[3px] border",
            check.met
              ? "border-primary/45 bg-primary/15 text-primary"
              : "border-border text-muted-foreground/50",
          )}
        >
          {check.met ? (
            <Check aria-hidden className="size-2.5" />
          ) : (
            <X aria-hidden className="size-2.5" />
          )}
        </span>
      ))}
    </span>
  );
}

/** One reviewed record. Opens in place; nothing here opens a dialog. */
function Record({
  entry,
  highlight,
  isChild = false,
}: {
  entry: EvidenceEntry;
  highlight?: HighlightedEvidence;
  isChild?: boolean;
}) {
  return (
    <AccordionItem value={entry.id} className={cn(isChild && "not-last:border-b-0")}>
      <AccordionTrigger className="gap-3 py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {isChild ? (
              <CornerDownRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/70" />
            ) : null}
            <span className="font-mono text-[0.78rem]">{entry.id}</span>
            <span className="text-[0.78rem] font-normal text-muted-foreground">
              {entry.sourceLocator}
            </span>
            {highlight ? (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0",
                  highlight.tone === "decisive"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground",
                )}
              >
                {highlight.badge}
              </Badge>
            ) : null}
            {entry.checks ? <Pips checks={entry.checks} /> : null}
          </span>
          <span className="text-[0.82rem] font-normal text-muted-foreground">{entry.summary}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        {highlight ? (
          <p className="mb-4 max-w-[72ch] text-[0.86rem] leading-6">{highlight.interpretation}</p>
        ) : null}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
          {entry.fields.map((field) => (
            <React.Fragment key={field.label}>
              <dt className="label pt-0.5 sm:text-right">{field.label}</dt>
              <dd
                className={cn(
                  "min-w-0 text-[0.85rem] leading-6 break-words",
                  // A field the reviewers left off is not the same as a
                  // recorded `unknown`, so the two never render alike.
                  field.value === null && "text-muted-foreground/70",
                  field.tone === "unknown" && "font-medium text-unknown",
                  field.tone === "mono" && "font-mono text-[0.8rem]",
                )}
              >
                {field.value ?? "Not recorded"}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </AccordionContent>
    </AccordionItem>
  );
}

/** A collapsed section for the detail most readers will not open. */
function Details({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="tool group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[0.9rem] font-medium [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <span
          aria-hidden
          className="text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-border p-4 sm:p-5">{children}</div>
    </details>
  );
}

function Band({
  children,
  label,
  heading,
}: {
  children: React.ReactNode;
  label: string;
  heading: string;
}) {
  return (
    <section className="mt-20 border-t border-border pt-16 sm:mt-24 sm:pt-20">
      <SectionLabel>{label}</SectionLabel>
      <SectionHeading className="mt-3 max-w-[26ch]">{heading}</SectionHeading>
      {children}
    </section>
  );
}

/* ─────────────────────────────── 3 · The sections ─────────────────────────── */

/** The finding, before the working. */
function Verdict({ view }: { view: PolicyTestView }) {
  const { receipt, summary } = view;
  const verdicts = [
    {
      place: "European Union",
      answer: "Yes, for one class",
      detail: statusLabel(receipt.eu.status),
      evidence: receipt.eu.decisiveEvidence,
      positive: true,
    },
    {
      place: "United States — federal",
      answer: "Not cross-sector",
      detail: statusLabel(receipt.us.status),
      evidence: [],
      positive: false,
    },
  ];

  return (
    <header className="border-b border-border">
      <div className="mx-auto grid max-w-[76rem] grid-cols-1 gap-x-14 gap-y-9 px-5 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <div className="min-w-0">
          <h1 className="max-w-[16ch] text-[length:var(--t-page)] leading-[1.04] font-semibold tracking-[-0.025em] text-balance">
            Where model evaluation is legally binding.
          </h1>
          <p className="mt-5 max-w-[58ch] text-base leading-7 text-muted-foreground text-pretty">
            One explicit rule, applied to the European Union and United States federal policy
            corpus, over {summary.normalizedClaimCount} human-reviewed claims.
          </p>
        </div>

        <ul className="min-w-0 space-y-2">
          {verdicts.map((verdict) => (
            <li
              key={verdict.place}
              className={cn(
                "rounded-xl border p-4",
                verdict.positive ? "border-primary/30 bg-primary/[0.06]" : "border-border",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="label">{verdict.place}</span>
                <span
                  className={cn(
                    "font-mono text-[0.72rem]",
                    verdict.evidence.length ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {verdict.evidence.length ? verdict.evidence.join(", ") : "no match"}
                </span>
              </div>
              <p
                className={cn(
                  "mt-1.5 text-[1.05rem] leading-snug font-semibold",
                  verdict.positive && "text-primary",
                )}
              >
                {verdict.answer}
              </p>
              <p className="mt-1 text-[0.8rem] leading-5 text-muted-foreground">{verdict.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

/** The rule, run as a preset. Every count is computed from the reviewed claims. */
function RuleExplorer({ view }: { view: PolicyTestView }) {
  const [presetId, setPresetId] = React.useState(PRESETS[0].id);
  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];

  // Bundle parents carry no legal force of their own; only claims are tested.
  const claims = React.useMemo(
    () => view.groups.flatMap((group) => (group.isBundle ? group.children : [group.parent])),
    [view.groups],
  );
  const matches = React.useMemo(
    () =>
      claims.filter((claim) =>
        preset.keys.every((key) => claim.checks?.find((check) => check.key === key)?.met),
      ),
    [claims, preset],
  );
  const euCount = matches.filter((claim) => claim.jurisdiction === "EU").length;

  return (
    <section>
      <SectionLabel>The rule</SectionLabel>
      <SectionHeading className="mt-3 max-w-[24ch]">
        Four conditions, all of which must hold.
      </SectionHeading>

      <ul className="mt-7 flex flex-wrap items-center gap-2">
        {view.ruleConditions
          .filter((condition) => condition.key !== null)
          .map((condition, index) => (
            <React.Fragment key={condition.source}>
              {index > 0 ? (
                <li aria-hidden className="text-muted-foreground/50">
                  +
                </li>
              ) : null}
              <li
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[0.85rem] font-medium",
                  preset.keys.includes(condition.key as RuleCheck["key"])
                    ? "border-primary/35 bg-primary/[0.07]"
                    : "border-dashed border-border text-muted-foreground/60 line-through",
                )}
              >
                {condition.value}
              </li>
            </React.Fragment>
          ))}
      </ul>

      <div role="group" aria-label="Choose a rule to run" className="mt-6 flex flex-wrap gap-1.5">
        {PRESETS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={item.id === presetId ? "default" : "outline"}
            aria-pressed={item.id === presetId}
            onClick={() => setPresetId(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        <Funnel claims={claims} conditions={view.ruleConditions} activeKeys={preset.keys} />
      </div>

      <p aria-live="polite" className="mt-4 max-w-[70ch] text-[0.9rem] leading-7">
        <span className="font-semibold tabular-nums">{matches.length}</span>
        <span className="text-muted-foreground">
          {" "}
          of {claims.length} claims match — EU {euCount}, US {matches.length - euCount}.{" "}
        </span>
        <span className="text-muted-foreground">{preset.takeaway}</span>
      </p>

      <Accordion className="mt-4">
        {matches.map((entry) => (
          <Record
            key={entry.id}
            entry={entry}
            highlight={view.highlights.find((item) => item.id === entry.id)}
          />
        ))}
      </Accordion>

      <p className="mt-5 text-[0.8rem] leading-6 text-muted-foreground">
        Scope searched: {view.includedScope.join(", ").toLowerCase()}. Excluded:{" "}
        {view.excludedScope.join(", ").toLowerCase()}.
      </p>
    </section>
  );
}

/** The four US findings, kept apart because collapsing them misreads all four. */
function UnitedStates({ view }: { view: PolicyTestView }) {
  return (
    <Band label="The United States" heading="So what does the US column contain?">
      <p className="mt-4 max-w-[68ch] text-[0.95rem] leading-7 text-muted-foreground">
        Zero is the answer to one question, not to every question. The seventeen US claims are real
        duties; they simply fall somewhere other than on market providers.
      </p>
      <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {view.receipt.us.subResults.map((result) => (
          <li key={result.key} className="tool p-5">
            <h3 className="text-[0.92rem] font-semibold">{result.title}</h3>
            <p className="mt-2 text-[0.86rem] leading-6 text-muted-foreground">{result.finding}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {result.evidence.map((id) => (
                <li key={id}>
                  <Badge variant="outline" className="font-mono">
                    {id}
                  </Badge>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Band>
  );
}

/** The whole corpus and the receipt, both collapsed until asked for. */
function Appendix({ view }: { view: PolicyTestView }) {
  const [filter, setFilter] = React.useState<"all" | "EU" | "US">("all");
  const { receipt, summary } = view;
  const groups = view.groups.filter(
    (group) => filter === "all" || group.parent.jurisdiction === filter,
  );

  const receiptRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Dataset", value: receipt.datasetId, mono: true },
    { label: "Schema version", value: receipt.schemaVersion, mono: true },
    { label: "Review status", value: "Human reviewed" },
    { label: "Pilot question", value: receipt.pilotQuestion },
    { label: "European Union", value: statusLabel(receipt.eu.status) },
    { label: "Defined class", value: receipt.eu.definedClass },
    { label: "Decisive evidence", value: receipt.eu.decisiveEvidence.join(", ") },
    { label: "Supporting evidence", value: receipt.eu.supportingEvidence.join(", ") },
    { label: "Qualification", value: receipt.eu.qualification },
    { label: "United States", value: statusLabel(receipt.us.status) },
    { label: "Reviewed source rows", value: String(summary.parentRowCount) },
    { label: "Normalized claims", value: String(summary.normalizedClaimCount) },
    { label: "Pending review", value: String(summary.pendingReviewCount) },
    { label: "Rejected review", value: String(summary.rejectedReviewCount) },
  ];

  return (
    <section className="mt-20 space-y-3 border-t border-border pt-16 sm:mt-24 sm:pt-20">
      <Details summary={`All reviewed evidence · ${summary.parentRowCount} source rows`}>
        <div role="group" aria-label="Filter by jurisdiction" className="flex flex-wrap gap-1.5">
          {(["all", "EU", "US"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={option === filter ? "secondary" : "ghost"}
              aria-pressed={option === filter}
              onClick={() => setFilter(option)}
            >
              {option === "all" ? "All" : option === "EU" ? "European Union" : "United States"}
            </Button>
          ))}
        </div>

        <Accordion className="mt-3">
          {groups.map((group) =>
            !group.isBundle ? (
              <Record key={group.parent.id} entry={group.parent} />
            ) : (
              <AccordionItem key={group.parent.id} value={group.parent.id}>
                <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="font-mono text-[0.78rem]">{group.parent.id}</span>
                      <span className="text-[0.78rem] font-normal text-muted-foreground">
                        {group.parent.sourceLocator}
                      </span>
                    </span>
                    <span className="text-[0.82rem] font-normal text-muted-foreground">
                      {group.parent.summary}
                    </span>
                  </span>
                </AccordionTrigger>
                {/* Derived claims stay nested inside the bundle that produced them. */}
                <AccordionContent className="pb-4">
                  <Accordion className="border-l border-border pl-3 sm:pl-4">
                    {group.children.map((child) => (
                      <Record key={child.id} entry={child} isChild />
                    ))}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            ),
          )}
        </Accordion>
      </Details>

      <Details summary="Assessment receipt">
        <dl className="divide-y divide-border">
          {receiptRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="label pt-0.5">{row.label}</dt>
              <dd
                className={cn(
                  "min-w-0 text-[0.86rem] leading-6 break-words",
                  row.mono && "font-mono text-[0.8rem]",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
            <dt className="label pt-0.5">Content hash</dt>
            <dd className="min-w-0">
              <HashPill hash={receipt.contentHash} chars={10} />
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[0.8rem] leading-6 text-muted-foreground">
          SHA-256 over the RFC 8785 canonical JSON of every field above.
        </p>
      </Details>
    </section>
  );
}

/* ──────────────────────────────── 4 · The page ────────────────────────────── */

export function PolicyTest({ view }: { view: PolicyTestView }) {
  return (
    <main>
      <Verdict view={view} />
      <div className="mx-auto max-w-[76rem] px-5 pt-14 pb-24 sm:px-6 sm:pt-16">
        <RuleExplorer view={view} />
        <UnitedStates view={view} />
        <Appendix view={view} />
      </div>
    </main>
  );
}
