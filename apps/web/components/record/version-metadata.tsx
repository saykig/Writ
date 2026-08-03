/**
 * Which corpus, which review, which file.
 *
 * A judgment that cannot be dated to a version of the evidence is not citable,
 * so this travels with every answer and every record rather than living once in
 * a footer. Paths are the repository's own; hashes are shown as pills that copy
 * in full, because a truncated hash is for recognising, not for checking.
 */

import { HashPill } from "@/components/site/hash-pill";
import { cn } from "@/lib/utils";

export interface VersionEntry {
  label: string;
  value: string;
  mono?: boolean;
}

export function VersionMetadata({
  heading,
  entries,
  hashes = [],
  className,
}: {
  heading?: string;
  entries: readonly VersionEntry[];
  hashes?: readonly { label: string; hash: string }[];
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {heading ? (
        <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
          {heading}
        </h3>
      ) : null}
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-[0.7rem] text-muted-foreground">{entry.label}</dt>
            <dd
              className={cn(
                "min-w-0 text-right text-[0.72rem] break-all text-foreground/85",
                entry.mono && "font-mono text-[0.68rem]",
              )}
            >
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
      {hashes.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {hashes.map((item) => (
            <HashPill key={item.label} hash={item.hash} label={item.label} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
