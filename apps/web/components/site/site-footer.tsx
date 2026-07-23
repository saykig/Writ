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
      <div className="mx-auto grid max-w-[76rem] gap-10 px-5 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div className="flex max-w-md flex-col gap-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-[2px] bg-gold" />
            <span className="text-[0.95rem] font-semibold tracking-tight text-foreground">
              Covenant
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            An auditable policy-evaluation compiler for G7 compliance. A methodology becomes a
            program, its evidence a frozen reviewed ledger, and each score a reproducible receipt.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-6 gap-y-2.5 md:justify-self-end" aria-label="Footer">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>

      <div className="mx-auto flex max-w-[76rem] flex-col gap-1 border-t border-border px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="font-mono text-xs text-muted-foreground">
          Deterministic · four-valued · content-hashed
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          2025 G7 AI-for-SMEs · reproduced 8 / 8
        </p>
      </div>
    </footer>
  );
}
