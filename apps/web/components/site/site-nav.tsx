"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommandMenu, OPEN_COMMAND_EVENT } from "@/components/site/command-menu";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { GITHUB_URL, PRIMARY_NAV } from "@/components/site/nav-items";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function openCommand() {
  window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));
}

/**
 * SiteNav — sticky top navigation: the COVENANT wordmark + tagline, the primary
 * route links with an active underline, a ⌘K trigger, the paper/sumi theme
 * toggle, and a GitHub link. Collapses to a Sheet below `lg`. Mounts the single
 * CommandMenu instance for the whole app.
 */
export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[76rem] items-center gap-5 px-5 sm:px-6">
        {/* Wordmark */}
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5"
          aria-label="Covenant — home"
        >
          <span
            aria-hidden
            className="h-4 w-px bg-gold transition-all duration-300 group-hover:h-5"
          />
          <span className="font-mono text-[0.92rem] font-medium tracking-[0.22em] text-foreground">
            COVENANT
          </span>
          <span aria-hidden className="hidden h-3.5 w-px bg-border md:inline-block" />
          <span className="hidden font-mono text-[0.66rem] tracking-[0.08em] text-ink-faint md:inline">
            policy-evaluation compiler
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-1 hidden h-full items-stretch gap-0.5 lg:flex" aria-label="Primary">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-3 text-[0.9rem] transition-colors",
                  active ? "text-foreground" : "text-ink-soft hover:text-foreground",
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-px after:origin-center after:bg-gold after:transition-transform after:duration-200",
                  active ? "after:scale-x-100" : "after:scale-x-0",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openCommand}
            aria-label="Open command menu"
            className="hidden h-7 items-center gap-2 rounded-[4px] border border-border bg-surface-2/40 pr-1.5 pl-2.5 text-[0.8rem] text-ink-soft transition-colors hover:border-gold/40 hover:text-foreground sm:inline-flex"
          >
            <Search className="size-3.5 opacity-70" />
            <span className="hidden md:inline">Search</span>
            <kbd className="rounded-[3px] border border-border bg-background px-1 py-0.5 font-mono text-[0.62rem] leading-none text-ink-faint">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Covenant on GitHub"
            nativeButton={false}
            render={
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
                <GitHubMark className="size-4" />
              </a>
            }
          />

          {/* Mobile trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open menu"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <SheetContent side="right" className="w-72 gap-0">
              <SheetHeader className="border-b border-border">
                <SheetTitle className="flex items-center gap-2 font-mono text-sm tracking-[0.22em]">
                  <span aria-hidden className="h-3.5 w-px bg-gold" />
                  COVENANT
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-2" aria-label="Primary">
                {PRIMARY_NAV.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <SheetClose
                      key={item.href}
                      render={
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex flex-col gap-0.5 rounded-[4px] px-3 py-2.5 transition-colors",
                            active
                              ? "bg-gold-wash text-foreground"
                              : "text-ink-soft hover:bg-surface-2 hover:text-foreground",
                          )}
                        >
                          <span className="text-[0.95rem]">{item.label}</span>
                          <span className="text-xs text-ink-faint">{item.hint}</span>
                        </Link>
                      }
                    />
                  );
                })}
              </nav>
              <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openCommand();
                  }}
                  className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-foreground"
                >
                  <Search className="size-3.5" /> Search
                  <kbd className="rounded-[3px] border border-border bg-background px-1 py-0.5 font-mono text-[0.62rem] text-ink-faint">
                    ⌘K
                  </kbd>
                </button>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-foreground"
                >
                  <GitHubMark className="size-4" /> GitHub
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <CommandMenu />
    </header>
  );
}
