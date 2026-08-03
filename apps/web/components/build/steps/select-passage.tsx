"use client";

/**
 * Step 3 — which words the record rests on.
 *
 * The whole pasted text is often more than the record classifies. Confirming a
 * span makes the record's evidence exact rather than approximate, and leaving it
 * as the whole passage is a legitimate answer, not a skipped step.
 */

import * as React from "react";

import type { BuildDraft } from "@/lib/build-draft";
import { selectedPassage } from "@/lib/build-draft";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SelectPassage({
  draft,
  onChange,
}: {
  draft: BuildDraft;
  onChange: (selection: { start: number; end: number } | null) => void;
}) {
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [pending, setPending] = React.useState<{ start: number; end: number } | null>(null);
  const passage = draft.source.passage;

  const readSelection = React.useCallback(() => {
    const selection = window.getSelection();
    const node = textRef.current?.firstChild;
    if (!selection || selection.isCollapsed || !node) return;
    if (selection.anchorNode !== node || selection.focusNode !== node) return;
    const start = Math.min(selection.anchorOffset, selection.focusOffset);
    const end = Math.max(selection.anchorOffset, selection.focusOffset);
    if (end > start) setPending({ start, end });
  }, []);

  if (!passage.trim()) {
    return (
      <p className="text-[0.84rem] leading-7 text-muted-foreground">
        No source passage has been entered yet. Go back to <em>Add source</em> and paste the
        document’s own words; there is nothing to select until then.
      </p>
    );
  }

  const current = draft.selection;
  return (
    <div className="space-y-5">
      <p className="text-[0.8rem] leading-6 text-muted-foreground">
        Select the words this record classifies, then confirm the selection. If the record rests on
        the whole passage, leave it as it is.
      </p>

      <p
        ref={textRef}
        onMouseUp={readSelection}
        onKeyUp={readSelection}
        className="rounded-lg border border-border bg-muted/20 px-4 py-4 font-serif text-[0.95rem] leading-8 selection:bg-gold-wash"
      >
        {passage}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={!pending}
          onClick={() => {
            if (pending) onChange(pending);
            setPending(null);
          }}
        >
          Use this selection
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!current}
          onClick={() => {
            onChange(null);
            setPending(null);
          }}
        >
          Use the whole passage
        </Button>
        <span
          className={cn("text-[0.74rem]", pending ? "text-foreground" : "text-muted-foreground")}
        >
          {pending
            ? `${pending.end - pending.start} characters selected`
            : current
              ? `${current.end - current.start} characters confirmed`
              : "The whole passage is in use"}
        </span>
      </div>

      {current ? (
        <div>
          <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
            Confirmed passage
          </h3>
          <blockquote className="mt-2 border-l border-border pl-4 font-serif text-[0.92rem] leading-8">
            “{selectedPassage(draft)}”
          </blockquote>
        </div>
      ) : null}
    </div>
  );
}
