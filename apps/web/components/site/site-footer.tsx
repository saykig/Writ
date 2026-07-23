import Link from "next/link";

import { GITHUB_URL, PRIMARY_NAV } from "@/components/site/nav-items";

/**
 * SiteFooter — quiet closing band: the seam motif (a hairline rule broken by a
 * short gold kintsugi segment), a one-line statement of what Covenant is, the
 * route list, and the GitHub link. Server component (no interactivity).
 */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      {/* Kintsugi seam motif: a hairline rule broken by a short gold segment. */}
      <div aria-hidden className="relative h-px w-full bg-border">
        <div className="absolute top-0 left-1/2 h-px w-24 -translate-x-1/2 bg-gold" />
      </div>

      <div className="mx-auto grid max-w-[76rem] gap-10 px-5 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div className="flex max-w-md flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="h-4 w-px bg-gold" />
            <span className="font-mono text-[0.92rem] font-medium tracking-[0.22em] text-foreground">
              COVENANT
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">
            An auditable policy-evaluation compiler for G7 compliance. A methodology becomes a
            program, its evidence a frozen reviewed ledger, and each score a reproducible receipt.
          </p>
          <p className="font-mono text-[0.7rem] leading-relaxed text-ink-faint">
            Gold marks where a score turns on judgment, not fact.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-6 gap-y-2.5 md:justify-self-end" aria-label="Footer">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-ink-soft transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>

      <div className="mx-auto flex max-w-[76rem] flex-col gap-1 px-5 pb-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono text-[0.66rem] tracking-[0.06em] text-ink-faint">
          Deterministic · four-valued · content-hashed
        </p>
        <p className="font-mono text-[0.66rem] tracking-[0.06em] text-ink-faint">
          2025 G7 AI-for-SMEs · reproduced 8 / 8
        </p>
      </div>
    </footer>
  );
}
