import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { TruthBadge } from "@/components/site/truth-badge";
import { HashPill } from "@/components/site/hash-pill";

/**
 * Pipeline — a plain, one-glance picture of what Writ does with a policy
 * rubric: read it as a program, check it before any evidence, score it against a
 * frozen record, and return an auditable receipt. Each stage shows a real
 * artifact, not an abstract icon, so the story reads left to right.
 */

function Stage({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <div className="tool flex flex-1 flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[0.7rem] font-semibold text-background">
          {step}
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div aria-hidden className="flex items-center justify-center py-1 lg:px-1">
      <ArrowRight className="size-4 rotate-90 text-muted-foreground lg:rotate-0" />
    </div>
  );
}

export function Pipeline() {
  return (
    <div className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-stretch">
      <Stage step="1" title="Write the rubric as a program">
        <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
          A scoring methodology, made precise. No spreadsheet, no prose left to interpret at
          run&nbsp;time.
        </p>
        <pre className="mt-auto overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-[0.72rem] leading-relaxed text-foreground/90">
          <code>{`score "+1" when strong >= 5
score "0"  when strong in 1..4
otherwise  unresolved`}</code>
        </pre>
      </Stage>

      <Connector />

      <Stage step="2" title="Writ checks it, then scores it">
        <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
          The analyzer flags ambiguity <em className="text-foreground not-italic">before</em> any
          evidence. Then it scores against a frozen, reviewed record — where{" "}
          <span className="text-foreground">unknown</span> never silently becomes false.
        </p>
        <div className="mt-auto flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-l-2 border-gold/40 border-l-gold bg-gold-wash px-2 py-1 font-mono text-[0.72rem] text-gold">
            gap: 0 strong, 5 weak → no rule matches
          </span>
          <span className="flex flex-wrap gap-1.5">
            <TruthBadge value="true" />
            <TruthBadge value="false" />
            <TruthBadge value="unknown" />
          </span>
        </div>
      </Stage>

      <Connector />

      <Stage step="3" title="Get an auditable receipt">
        <p className="text-[0.82rem] leading-relaxed text-muted-foreground">
          Every score is reproducible, and it names exactly where the result turns on a judgment
          rather than a fact.
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[0.82rem] text-muted-foreground">
            score
            <TruthBadge value="0" />
            <span aria-hidden>·</span>
            <span className="text-gold">interpretation-sensitive</span>
          </span>
          <HashPill hash={`sha256:${"a3f1c9".padEnd(12, "0")}`} />
        </div>
      </Stage>
    </div>
  );
}
