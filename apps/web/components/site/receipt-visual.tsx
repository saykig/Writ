import { TruthBadge } from "@/components/site/truth-badge";

/**
 * ReceiptVisual — the product's signature artifact, rendered as the hero image:
 * a real evaluation receipt for Japan, whose published `0` turns on how one
 * phrase is read. It shows the score, the interpretation-sensitive flag, the two
 * readings that flip it, and the content hash that makes it reproducible. Static
 * (no data fetch) so it renders instantly and identically.
 */
export function ReceiptVisual() {
  return (
    <div className="relative w-full max-w-sm">
      {/* soft stacked shadow for depth */}
      <div
        aria-hidden
        className="absolute inset-0 translate-x-3 translate-y-3 rounded-xl border border-border bg-card/40"
      />
      <figure className="relative overflow-hidden rounded-xl border border-border bg-card shadow-[0_8px_30px_-12px_color-mix(in_oklab,var(--foreground)_25%,transparent)]">
        <figcaption className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
          <span className="label">Evaluation receipt</span>
          <span className="font-mono text-[0.7rem] text-muted-foreground">japan · 2025 ai-sme</span>
        </figcaption>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.72rem] tracking-wide text-muted-foreground uppercase">
                Published score
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums">0</span>
                <TruthBadge value="0" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-gold-wash px-2 py-1 text-[0.7rem] font-medium text-gold">
              interpretation-sensitive
            </span>
          </div>

          {/* the flip */}
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
              &ldquo;up to four strong actions&rdquo;
            </p>
            <div className="mt-2 flex flex-col gap-1.5 font-mono text-[0.75rem]">
              <span className="flex items-center justify-between">
                <span className="text-muted-foreground">strict reading</span>
                <TruthBadge value="0" />
              </span>
              <span className="flex items-center justify-between">
                <span className="text-muted-foreground">generous reading</span>
                <TruthBadge value="+1" />
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="label">Content hash</span>
            <span className="max-w-[60%] truncate font-mono text-[0.7rem] text-muted-foreground">
              sha256:9e88bb36…
            </span>
          </div>
        </div>
      </figure>
    </div>
  );
}
