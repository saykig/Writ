import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * CodeArtifact — a mono source/IR display card. Renders `code` with a line-number
 * gutter; line numbers listed in `seam` (1-based) are marked with the gold
 * kintsugi seam (left border + wash) to point at where judgment enters. An
 * optional `caption` renders a seam-marked note below (e.g. a witness). The
 * header carries a mono `label` (left) and `filename` (right).
 */
export function CodeArtifact({
  code,
  label,
  filename,
  seam = [],
  caption,
  showLineNumbers = true,
  className,
}: {
  code: string;
  label?: string;
  filename?: string;
  seam?: readonly number[];
  caption?: ReactNode;
  showLineNumbers?: boolean;
  className?: string;
}) {
  const lines = code.replace(/\n$/, "").split("\n");
  const marked = new Set(seam);
  const gutter = String(lines.length).length;

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[4px] border border-border bg-surface-2/40 ring-1 ring-foreground/[0.03]",
        className,
      )}
    >
      {(label || filename) && (
        <figcaption className="flex items-center justify-between gap-4 border-b border-border/80 bg-surface-2/60 px-3.5 py-2">
          {label ? <span className="label-mono">{label}</span> : <span />}
          {filename ? (
            <span className="font-mono text-[0.72rem] text-ink-faint">{filename}</span>
          ) : null}
        </figcaption>
      )}

      <div className="overflow-x-auto py-2.5">
        <pre className="min-w-max font-mono text-[0.8rem] leading-[1.6]">
          <code>
            {lines.map((line, i) => {
              const n = i + 1;
              const isSeam = marked.has(n);
              return (
                <span
                  key={i}
                  className={cn(
                    "flex border-l-2 border-transparent pr-4 pl-3",
                    isSeam && "border-gold bg-gold-wash",
                  )}
                >
                  {showLineNumbers && (
                    <span
                      aria-hidden
                      className="mr-4 inline-block shrink-0 select-none text-right text-ink-faint/70 tabular-nums"
                      style={{ width: `${gutter}ch` }}
                    >
                      {n}
                    </span>
                  )}
                  <span className="whitespace-pre text-foreground/90">{line || " "}</span>
                </span>
              );
            })}
          </code>
        </pre>
      </div>

      {caption ? (
        <div className="border-t border-border/80 bg-gold-wash px-3.5 py-2.5 pl-[calc(0.875rem-2px)] [border-left:2px_solid_var(--gold)]">
          <div className="text-sm leading-snug text-ink-soft">{caption}</div>
        </div>
      ) : null}
    </figure>
  );
}
