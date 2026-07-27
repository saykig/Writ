"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GITHUB_URL, PRIMARY_NAV, RESEARCH_NAV, SECONDARY_NAV } from "@/components/site/nav-items";

/**
 * Quiet closing band shared by every non-homepage route.
 */
export function SiteFooter() {
  const pathname = usePathname();
  // The tools kept out of the header stay reachable here.
  const productLinks = [
    ...PRIMARY_NAV.filter((item) => item.href !== "/how-it-works"),
    ...SECONDARY_NAV,
  ];
  const resourceLinks = [
    PRIMARY_NAV.find((item) => item.href === "/how-it-works"),
    ...RESEARCH_NAV,
  ].filter((item) => item !== undefined);

  if (pathname === "/") {
    return null;
  }

  return (
    <footer className="mt-24 border-t border-border bg-card/25">
      <div className="mx-auto grid max-w-[76rem] gap-12 px-5 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.35fr_0.7fr_0.8fr_0.9fr] lg:gap-16">
        <div className="flex max-w-sm flex-col gap-4">
          <span className="text-3xl font-semibold tracking-[-0.035em] text-foreground">Writ</span>
          <p className="text-sm leading-7 text-muted-foreground">
            A Domain-Specific Language (DSL) for expressing rule-based policy evaluation
            methodologies over reviewed evidence and producing reproducible assessment receipts.
          </p>
        </div>

        <nav className="flex flex-col gap-3" aria-label="Product">
          <p className="text-sm font-semibold text-foreground">Product</p>
          {productLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <nav className="flex flex-col gap-3" aria-label="Resources">
          <p className="text-sm font-semibold text-foreground">Resources</p>
          {resourceLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex max-w-xs flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Project</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Inspect the source, follow development, or contribute on GitHub.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex w-fit items-center text-sm font-medium text-primary transition-colors hover:text-foreground"
          >
            View Writ on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
