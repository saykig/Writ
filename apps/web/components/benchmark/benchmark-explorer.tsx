"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Stamp } from "lucide-react";

import { cn } from "@/lib/utils";
import { HashPill } from "@/components/site/hash-pill";
import { TruthBadge } from "@/components/site/truth-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { ActionView, MemberView } from "./types";

/** ISO instant → calendar date (deterministic; avoids locale hydration drift). */
function day(iso: string): string {
  return iso.slice(0, 10);
}

/** A small classification chip — `strong` pushes toward +1, `weak` toward the floor. */
function ClassChip({ value, className }: { value: string; className?: string }) {
  const strong = value === "strong";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.68rem] leading-none tracking-tight lowercase",
        strong ? "border-true/35 bg-true/10 text-true" : "border-rule bg-paper-deep text-ink-faint",
        className,
      )}
    >
      {value}
    </span>
  );
}

/** The evidence chain for one action: classification → anchoring passage → review. */
function ActionRecord({ action }: { action: ActionView }) {
  const meta = [
    action.jurisdiction,
    action.kind.replace(/_/g, " "),
    action.implementationStage.replace(/_/g, " "),
    `${action.targeting.replace(/_/g, " ")} targeting`,
  ];

  return (
    <li className="border-t border-rule pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-display text-[1.05rem] leading-snug tracking-[-0.005em] text-balance">
          {action.label}
        </h4>
        {action.sensitive ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-gold/40 bg-gold-wash px-1.5 py-0.5 font-mono text-[0.66rem] leading-none text-gold">
            weak <ArrowRight className="size-2.5" aria-hidden /> strong
          </span>
        ) : (
          <ClassChip value={action.classification} className="mt-0.5 shrink-0" />
        )}
      </div>

      <p className="mt-2 font-mono text-[0.67rem] leading-relaxed tracking-tight text-ink-faint">
        {meta.join("  ·  ")}
      </p>

      {/* classification claim */}
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem]">
        <span className="font-mono text-ink-faint">{action.claim.predicate}</span>
        <ArrowRight className="size-3 text-ink-faint" aria-hidden />
        {action.sensitive ? (
          <span className="font-mono text-gold">
            {action.claim.object} <span className="text-ink-faint">→ strong (generous)</span>
          </span>
        ) : (
          <span className="font-mono text-foreground">{action.claim.object}</span>
        )}
      </p>

      {/* anchoring passage */}
      <figure className="mt-3 border-l border-rule pl-4">
        <blockquote className="font-display text-[0.95rem] leading-relaxed text-ink-soft [text-wrap:pretty]">
          {action.passage.quote}
        </blockquote>
        <figcaption className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {action.passage.page != null ? (
            <span className="font-mono text-[0.67rem] text-ink-faint tabular-nums">
              p.{action.passage.page}
            </span>
          ) : null}
          <HashPill hash={action.passage.anchorHash} label="anchor" chars={8} />
        </figcaption>
      </figure>

      {/* reviewer decision */}
      <p className="mt-3.5 flex items-start gap-2 text-[0.78rem] leading-relaxed text-ink-muted">
        <Stamp className="mt-[0.15rem] size-3 shrink-0 text-ink-faint" aria-hidden />
        <span>
          <span className="font-mono text-ink-faint">{action.review.reviewerId}</span>
          <span className="text-ink-faint"> · </span>
          <span className="text-true">{action.review.decision}ed</span>
          {action.review.rationale ? (
            <>
              <span className="text-ink-faint">. </span>
              <span>{action.review.rationale}</span>
            </>
          ) : null}
        </span>
      </p>
    </li>
  );
}

/** One column of the reading ledger: score badge, matched rule, counts, receipt. */
function ReadingColumn({
  label,
  score,
  rule,
  counts,
  receiptHash,
  emphasis = false,
}: {
  label: string;
  score: MemberView["published"];
  rule: string;
  counts: string;
  receiptHash: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label text-ink-muted">{label}</span>
      <div className="flex items-center gap-2">
        <TruthBadge value={score} />
        <span className="font-mono text-[0.7rem] text-ink-faint">{rule}</span>
      </div>
      <span
        className={cn(
          "font-mono text-[0.72rem] tabular-nums",
          emphasis ? "text-gold" : "text-ink-soft",
        )}
      >
        {counts}
      </span>
      <HashPill hash={receiptHash} label="receipt" chars={8} className="self-start" />
    </div>
  );
}

/** Header + reading ledger + full evidence list for the open member. */
function MemberDrilldown({ member }: { member: MemberView }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="gap-3 border-b border-rule px-6 pt-6 pb-5">
        <span className="label text-ink-muted">Frozen evidence snapshot</span>
        <SheetTitle className="font-display text-[1.7rem] leading-[1.1] tracking-[-0.01em] text-foreground">
          {member.label}
        </SheetTitle>
        <SheetDescription className="max-w-[46ch] text-ink-soft">
          {member.sensitive
            ? "The published score holds only if general, non-SME AI measures are read as weak. Read them as strong and it flips."
            : "An interpretation-independent score: the record reads the same way under either profile."}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[0.7rem] text-ink-faint">
          <span className="tabular-nums">frozen {day(member.snapshot.frozenAt)}</span>
          <span className="tabular-nums">cutoff {day(member.snapshot.cutoff)}</span>
          <HashPill hash={member.snapshot.contentHash} label="content" chars={10} />
        </div>
      </SheetHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-8 px-6 py-7">
          {/* reading ledger */}
          <div
            className={cn(
              "rounded-lg border p-5",
              member.sensitive ? "border-gold/30 bg-gold-wash" : "border-rule bg-paper-deep/40",
            )}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-6">
              <ReadingColumn
                label="Published reading"
                score={member.published}
                rule={member.publishedRule}
                counts={`${member.strongCount} strong · ${member.weakCount} weak`}
                receiptHash={member.publishedHash}
              />
              <ReadingColumn
                label="Generous reading"
                score={member.generous}
                rule={member.generousRule}
                counts={`${member.generousStrongCount} strong · ${member.weakCount - member.sensitiveCount} weak`}
                receiptHash={member.generousHash}
                emphasis={member.sensitive}
              />
            </div>
            {member.sensitive ? (
              <p className="mt-5 flex flex-wrap items-center gap-2 border-t border-gold/25 pt-4 text-[0.78rem] text-ink-soft">
                <TruthBadge value={member.published} />
                <ArrowRight className="size-3 text-gold" aria-hidden />
                <TruthBadge value={member.generous} />
                <span>
                  {member.sensitiveCount} general AI{" "}
                  {member.sensitiveCount === 1 ? "measure" : "measures"} decide the score.
                </span>
              </p>
            ) : null}
          </div>

          {/* the record */}
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label text-ink-muted">The record</span>
              <span className="font-mono text-[0.7rem] text-ink-faint tabular-nums">
                {member.qualifyingCount} qualifying{" "}
                {member.qualifyingCount === 1 ? "action" : "actions"}
              </span>
            </div>
            <ul className="flex flex-col gap-6">
              {member.actions.map((action) => (
                <ActionRecord key={action.id} action={action} />
              ))}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/** The eight-member matrix. Clicking (or Enter/Space on) a row opens its evidence drawer. */
export function BenchmarkExplorer({ members }: { members: readonly MemberView[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((id: string, el: HTMLElement) => {
    triggerRef.current = el;
    setOpenId(id);
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setOpenId(null);
      // Return focus to the row that opened the drawer.
      triggerRef.current?.focus();
      triggerRef.current = null;
    }
  }, []);

  const active = members.find((m) => m.id === openId) ?? null;

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-rule bg-paper-raise/40">
        <Table>
          <TableHeader>
            <TableRow className="border-rule hover:bg-transparent">
              <TableHead className="label h-12 px-5 text-ink-muted">Member</TableHead>
              <TableHead className="label h-12 text-ink-muted">Published</TableHead>
              <TableHead className="label h-12 text-ink-muted">Computed</TableHead>
              <TableHead className="label h-12 text-ink-muted">Generous</TableHead>
              <TableHead className="label h-12 text-ink-muted">Strong actions</TableHead>
              <TableHead className="label h-12 pr-5 text-ink-muted">
                <span className="sr-only">Evidence</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow
                key={m.id}
                role="button"
                tabIndex={0}
                aria-haspopup="dialog"
                aria-label={`Open the frozen evidence for ${m.label}`}
                onClick={(e) => open(m.id, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(m.id, e.currentTarget);
                  }
                }}
                className={cn(
                  "group relative cursor-pointer border-rule transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold/55",
                  m.sensitive ? "bg-gold-wash hover:bg-gold-wash" : "hover:bg-paper-deep/50",
                )}
              >
                <TableCell className="relative py-4 pr-3 pl-5">
                  {m.sensitive ? (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-gold" />
                  ) : null}
                  <span className="font-display text-[1.02rem] tracking-[-0.005em]">{m.label}</span>
                  {m.sensitive ? (
                    <span className="mt-1 block text-[0.66rem] font-semibold tracking-[0.12em] text-gold uppercase">
                      interpretation-sensitive
                    </span>
                  ) : null}
                </TableCell>

                <TableCell className="py-4">
                  <TruthBadge value={m.published} />
                </TableCell>

                <TableCell className="py-4">
                  <TruthBadge value={m.computed} />
                </TableCell>

                <TableCell className="py-4">
                  {m.sensitive ? (
                    <span className="inline-flex items-center gap-1.5">
                      <TruthBadge value={m.published} className="opacity-50" />
                      <ArrowRight className="size-3 text-gold" aria-hidden />
                      <TruthBadge value={m.generous} />
                    </span>
                  ) : (
                    <TruthBadge value={m.generous} className="opacity-45" />
                  )}
                </TableCell>

                <TableCell className="py-4 font-mono text-[0.82rem] tabular-nums">
                  {m.sensitive ? (
                    <span className="text-gold">
                      {m.strongCount}
                      <ArrowRight className="mx-1 inline-block size-3 align-[-0.1em]" aria-hidden />
                      {m.generousStrongCount}
                      <span className="text-ink-faint"> of {m.qualifyingCount}</span>
                    </span>
                  ) : (
                    <span className="text-ink-soft">
                      {m.strongCount}
                      <span className="text-ink-faint"> of {m.qualifyingCount}</span>
                    </span>
                  )}
                </TableCell>

                <TableCell className="py-4 pr-5 text-right">
                  <ChevronRight
                    aria-hidden
                    className="inline-block size-4 -translate-x-1 text-ink-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
                  />
                  <span className="sr-only">View evidence</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableCaption className="border-t border-rule px-5 py-4 text-left text-[0.82rem] leading-relaxed text-ink-muted">
            Japan and the United States hold a published{" "}
            <TruthBadge value="0" className="mx-0.5 align-middle" /> only if general, non-SME AI
            legislation reads <span className="text-gold">weak</span>. Read it{" "}
            <span className="text-gold">strong</span> and both flip to{" "}
            <TruthBadge value="+1" className="mx-0.5 align-middle" />. The other six do not move.
          </TableCaption>
        </Table>
      </div>

      <Sheet open={active !== null} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl!">
          {active ? (
            <MemberDrilldown member={active} />
          ) : (
            <SheetHeader className="sr-only">
              <SheetTitle>Member evidence</SheetTitle>
              <SheetDescription>Frozen evidence snapshot.</SheetDescription>
            </SheetHeader>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
