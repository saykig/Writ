"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/** Split a `sha256:<hex>` string; falls back to treating the whole value as hex. */
function parts(hash: string): { algo: string; hex: string } {
  const i = hash.indexOf(":");
  if (i === -1) return { algo: "", hex: hash };
  return { algo: hash.slice(0, i), hex: hash.slice(i + 1) };
}

/**
 * HashPill — a compact mono pill for a content hash (e.g. `sha256:…`). Shows a
 * truncated form; click copies the full hash to the clipboard with a toast.
 * `chars` controls how many leading hex characters are shown (default 8).
 */
export function HashPill({
  hash,
  chars = 8,
  label,
  className,
}: {
  hash: string;
  chars?: number;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { algo, hex } = parts(hash);
  const shown = hex.length > chars ? `${hex.slice(0, chars)}…` : hex;

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      toast.success("Hash copied", { description: hash });
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={hash}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-[3px] border border-border bg-surface-2/60 px-2 py-0.5 font-mono text-[0.72rem] leading-none text-ink-soft transition-colors hover:border-gold/40 hover:text-foreground focus-visible:border-gold/60 focus-visible:outline-none",
        className,
      )}
    >
      {label ? <span className="text-ink-faint">{label}</span> : null}
      {algo ? <span className="text-ink-faint">{algo}:</span> : null}
      <span className="tabular-nums">{shown}</span>
      {copied ? (
        <Check className="size-3 text-true" aria-hidden />
      ) : (
        <Copy
          className="size-3 opacity-50 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      )}
      <span className="sr-only">Copy full hash</span>
    </button>
  );
}
