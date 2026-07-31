"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { GITHUB_URL, PRIMARY_NAV } from "@/components/site/nav-items";

/**
 * Quiet closing band shared by every non-homepage route.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") {
    return null;
  }

  return (
    <footer data-site-chrome className="mt-24 border-t border-border bg-card/25">
      <div className="mx-auto grid max-w-[76rem] gap-12 px-5 py-16 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.9fr] lg:gap-16">
        <div className="flex max-w-sm flex-col gap-4">
          <span className="text-3xl font-semibold tracking-[-0.035em] text-foreground">Writ</span>
          <p className="text-sm leading-7 text-muted-foreground">
            A source-grounded knowledge system and domain-specific language for political science
            and global affairs, with explicit uncertainty and traceable derived results.
          </p>
        </div>

        <nav className="flex flex-col gap-3" aria-label="Site">
          <p className="text-sm font-semibold text-foreground">Site</p>
          {PRIMARY_NAV.map((item) => (
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
