import type { ReactNode } from "react";
import { ScanSearch, Scale, Fingerprint, GitFork } from "lucide-react";

import { TruthBadge } from "@/components/site/truth-badge";
import { Term } from "@/components/site/term";

/**
 * FeatureGrid — the four things that make Writ different, as a bento of
 * shadcn-style cards. Each carries a real visual (a gap flag, the four truth
 * values, a hash, the amber judgment marker), not a decorative icon alone.
 */

function Card({
  icon,
  title,
  children,
  visual,
  className,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  visual: ReactNode;
  className?: string;
}) {
  return (
    <div className={`tool flex flex-col gap-4 p-6 ${className ?? ""}`}>
      <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">{children}</p>
      </div>
      <div className="mt-auto pt-1">{visual}</div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        icon={<ScanSearch className="size-4" />}
        title="Catches ambiguity early"
        visual={
          <span className="inline-flex items-center rounded-md border border-l-2 border-gold/40 border-l-gold bg-gold-wash px-2 py-1 font-mono text-[0.7rem] text-gold">
            gap · no rule matches
          </span>
        }
      >
        The analyzer proves a rubric has a gap or an overlap before any evidence exists — like a
        compiler catching a bug.
      </Card>

      <Card
        icon={<Scale className="size-4" />}
        title="Four-valued truth"
        visual={
          <span className="flex flex-wrap gap-1.5">
            <TruthBadge value="true" />
            <TruthBadge value="false" />
            <TruthBadge value="unknown" />
          </span>
        }
      >
        Evidence can be true, false, unknown, or{" "}
        <Term definition="Contested: the evidence genuinely supports both true and false at once (conflicting reviewed sources). It is kept distinct, not averaged away.">
          contested
        </Term>
        . <em className="not-italic text-foreground">Unknown</em> never silently becomes false, so a
        score is never a guess.
      </Card>

      <Card
        icon={<Fingerprint className="size-4" />}
        title="Reproducible receipts"
        visual={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[0.7rem] text-muted-foreground">
            <Fingerprint className="size-3" />
            sha256:9e88bb36…
          </span>
        }
      >
        Every score is content-hashed and recomputable from frozen, reviewed evidence. Change one
        quote and the hash changes.
      </Card>

      <Card
        icon={<GitFork className="size-4" />}
        title="Names the judgment"
        visual={
          <span className="flex items-center gap-2 font-mono text-[0.72rem]">
            <TruthBadge value="0" />
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <TruthBadge value="+1" />
          </span>
        }
      >
        Where a score turns on a reading rather than a fact, Writ marks the exact cell and shows the
        reading that flips it.
      </Card>
    </div>
  );
}
