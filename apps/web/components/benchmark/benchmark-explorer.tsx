"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, Landmark, Quote, Stamp } from "lucide-react";

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
        "inline-flex items-center rounded-[3px] border px-1.5 py-0.5 font-mono text-[0.7rem] leading-none tracking-tight lowercase",
        strong
          ? "border-true/35 bg-true/10 text-true"
          : "border-border bg-surface-2/70 text-ink-faint",
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
    <li
      className={cn(
        "rounded-[4px] border p-3.5",
        action.sensitive ? "border-gold/45 bg-gold-wash" : "border-border bg-surface-2/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-serif text-[0.98rem] leading-snug tracking-tight text-balance">
          {action.label}
        </h4>
        {action.sensitive ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] border border-gold/45 bg-gold-wash px-1.5 py-0.5 font-mono text-[0.7rem] leading-none text-gold">
            weak <ArrowRight className="size-2.5" aria-hidden /> strong
          </span>
        ) : (
          <ClassChip value={action.classification} className="shrink-0" />
        )}
      </div>

      <p className="mt-1.5 font-mono text-[0.68rem] leading-relaxed tracking-tight text-ink-faint">
        {meta.join("  ·  ")}
      </p>

      {/* classification claim */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8rem] text-ink-soft">
        <span className="font-mono text-ink-faint">{action.claim.predicate}</span>
        <ArrowRight className="size-3 text-ink-faint" aria-hidden />
        {action.sensitive ? (
          <span className="font-mono text-gold">
            {action.claim.object} <span className="text-ink-faint">→ strong (generous)</span>
          </span>
        ) : (
          <span className="font-mono text-foreground">{action.claim.object}</span>
        )}
        <span className="text-ink-faint">·</span>
        <span className="font-mono text-ink-faint">{action.claim.status}</span>
      </div>

      {/* anchoring passage */}
      <figure
        className={cn("mt-3 border-l-2 pl-3", action.sensitive ? "border-gold" : "border-border")}
      >
        <Quote className="size-3 text-ink-faint" aria-hidden />
        <blockquote className="mt-1 font-serif text-[0.9rem] leading-relaxed text-foreground/90 [text-wrap:pretty]">
          {action.passage.quote}
        </blockquote>
        <figcaption className="mt-2 flex flex-wrap items-center gap-2">
          {action.passage.page != null ? (
            <span className="font-mono text-[0.7rem] text-ink-faint tabular-nums">
              p.{action.passage.page}
            </span>
          ) : null}
          <HashPill hash={action.passage.anchorHash} label="anchor" chars={8} />
        </figcaption>
      </figure>

      {/* reviewer decision */}
      <div className="mt-3 flex items-start gap-2 border-t border-border/70 pt-2.5">
        <Stamp className="mt-0.5 size-3 shrink-0 text-ink-faint" aria-hidden />
        <p className="text-[0.78rem] leading-relaxed text-ink-soft">
          <span className="font-mono text-ink-faint">{action.review.reviewerId}</span>
          <span className="text-ink-faint"> · </span>
          <span className="text-true">{action.review.decision}ed</span>
          <span className="text-ink-faint"> — </span>
          {action.review.rationale}
        </p>
      </div>
    </li>
  );
}

/** Header + reading ledger + full evidence list for the open member. */
function MemberDrilldown({ member }: { member: MemberView }) {
  return (
    <div className="flex flex-col">
      <SheetHeader className="gap-3 border-b border-border px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-px bg-gold" />
          <span className="label-mono">Frozen evidence snapshot</span>
        </div>
        <SheetTitle className="font-serif text-2xl leading-tight tracking-tight">
          {member.label}
        </SheetTitle>
        <SheetDescription className="text-ink-soft">
          {member.sensitive
            ? "The published score holds only if general, non-SME AI measures are read as weak. Read them as strong and it flips."
            : "An interpretation-independent score: the record reads the same way under either profile."}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[0.7rem] text-ink-faint">
          <span className="tabular-nums">frozen {day(member.snapshot.frozenAt)}</span>
          <span className="tabular-nums">cutoff {day(member.snapshot.cutoff)}</span>
          <HashPill hash={member.snapshot.contentHash} label="content" chars={10} />
        </div>
      </SheetHeader>

      <ScrollArea className="h-[calc(100dvh-9.5rem)]">
        <div className="flex flex-col gap-6 px-5 py-5">
          {/* reading ledger */}
          <div
            className={cn(
              "rounded-[4px] border p-4",
              member.sensitive ? "border-gold/40 bg-gold-wash" : "border-border bg-surface-2/30",
            )}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="flex flex-col gap-1.5">
                <span className="label-mono">Published reading</span>
                <div className="flex items-center gap-2">
                  <TruthBadge value={member.published} />
                  <span className="font-mono text-[0.72rem] text-ink-faint">
                    {member.publishedRule}
                  </span>
                </div>
                <span className="font-mono text-[0.72rem] text-ink-soft tabular-nums">
                  {member.strongCount} strong · {member.weakCount} weak
                </span>
                <HashPill hash={member.publishedHash} label="receipt" chars={8} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="label-mono">Generous reading</span>
                <div className="flex items-center gap-2">
                  <TruthBadge value={member.generous} />
                  <span className="font-mono text-[0.72rem] text-ink-faint">
                    {member.generousRule}
                  </span>
                </div>
                <span
                  className={cn(
                    "font-mono text-[0.72rem] tabular-nums",
                    member.sensitive ? "text-gold" : "text-ink-soft",
                  )}
                >
                  {member.generousStrongCount} strong · {member.weakCount - member.sensitiveCount}{" "}
                  weak
                </span>
                <HashPill hash={member.generousHash} label="receipt" chars={8} />
              </div>
            </div>
            {member.sensitive ? (
              <p className="mt-4 flex items-center gap-2 border-t border-gold/30 pt-3 font-mono text-[0.72rem] text-gold tabular-nums">
                <TruthBadge value={member.published} />
                <ArrowRight className="size-3" aria-hidden />
                <TruthBadge value={member.generous} />
                <span className="font-sans text-ink-soft">
                  {member.sensitiveCount} general AI{" "}
                  {member.sensitiveCount === 1 ? "measure" : "measures"} decide the score.
                </span>
              </p>
            ) : null}
          </div>

          {/* the record */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label-mono flex items-center gap-1.5">
                <Landmark className="size-3" aria-hidden /> The record
              </span>
              <span className="font-mono text-[0.7rem] text-ink-faint tabular-nums">
                {member.qualifyingCount} qualifying{" "}
                {member.qualifyingCount === 1 ? "action" : "actions"}
              </span>
            </div>
            <ul className="flex flex-col gap-2.5">
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
      <div className="overflow-hidden rounded-[4px] border border-border ring-1 ring-foreground/[0.03]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="label-mono h-10 px-4">Member</TableHead>
              <TableHead className="label-mono h-10">Published</TableHead>
              <TableHead className="label-mono h-10">Computed</TableHead>
              <TableHead className="label-mono h-10">Generous</TableHead>
              <TableHead className="label-mono h-10">Strong actions</TableHead>
              <TableHead className="label-mono h-10">Match</TableHead>
              <TableHead className="label-mono h-10 pr-4 text-right">Evidence</TableHead>
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
                  "group relative cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-inset",
                  m.sensitive ? "bg-gold-wash hover:bg-gold-wash/80" : "hover:bg-surface-2/40",
                )}
              >
                <TableCell className="relative py-3 pr-3 pl-4">
                  {m.sensitive ? (
                    <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-gold" />
                  ) : null}
                  <span className="font-serif text-[0.98rem] tracking-tight">{m.label}</span>
                  {m.sensitive ? (
                    <span className="mt-0.5 block font-mono text-[0.66rem] leading-none tracking-tight text-gold">
                      reading-sensitive
                    </span>
                  ) : null}
                </TableCell>

                <TableCell className="py-3">
                  <TruthBadge value={m.published} />
                </TableCell>

                <TableCell className="py-3">
                  <TruthBadge value={m.computed} />
                </TableCell>

                <TableCell className="py-3">
                  {m.sensitive ? (
                    <span className="inline-flex items-center gap-1">
                      <TruthBadge value={m.published} className="opacity-55" />
                      <ArrowRight className="size-3 text-gold" aria-hidden />
                      <TruthBadge value={m.generous} />
                    </span>
                  ) : (
                    <TruthBadge value={m.generous} className="opacity-55" />
                  )}
                </TableCell>

                <TableCell className="py-3 font-mono text-[0.82rem] tabular-nums">
                  {m.sensitive ? (
                    <span className="text-gold">
                      {m.strongCount}
                      <span className="text-ink-faint"> → </span>
                      {m.generousStrongCount}
                    </span>
                  ) : (
                    <span className="text-ink-soft">{m.strongCount}</span>
                  )}
                </TableCell>

                <TableCell className="py-3">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] text-true">
                    <Check className="size-3.5" aria-hidden />
                    exact
                  </span>
                </TableCell>

                <TableCell className="py-3 pr-4 text-right">
                  <ChevronRight
                    aria-hidden
                    className="inline-block size-4 -translate-x-1 text-ink-faint opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
                  />
                  <span className="sr-only">View evidence</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableCaption className="px-4 pb-3 text-left text-ink-soft">
            The two reading-sensitive scores — Japan and the United States — hold a published{" "}
            <TruthBadge value="0" className="mx-0.5 align-middle" /> only if general, non-SME AI
            legislation is read as <span className="text-gold">weak</span>. Read it as{" "}
            <span className="text-gold">strong</span> and both flip to{" "}
            <TruthBadge value="+1" className="mx-0.5 align-middle" />. The other six do not move.
          </TableCaption>
        </Table>
      </div>

      <Sheet open={active !== null} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
          {active ? (
            <MemberDrilldown member={active} />
          ) : (
            <>
              <SheetHeader className="sr-only">
                <SheetTitle>Member evidence</SheetTitle>
                <SheetDescription>Frozen evidence snapshot.</SheetDescription>
              </SheetHeader>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
