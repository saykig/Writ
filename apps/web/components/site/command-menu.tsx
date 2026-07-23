"use client";

import { useCallback, useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CornerDownRight, FileCode2 } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EXAMPLE_ITEMS, PRIMARY_NAV } from "@/components/site/nav-items";

/** Custom event other components dispatch to open the palette (see SiteNav). */
export const OPEN_COMMAND_EVENT = "covenant:open-command";

/**
 * CommandMenu — the ⌘K palette. Mounted once (in SiteNav). Toggles on ⌘K/Ctrl+K
 * and opens on the `covenant:open-command` window event, so any button can
 * trigger it. Jumps to a route or loads an example reading in the playground.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, []);

  const go = useCallback(
    (href: Route) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page, or load an example…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem value="Home overview" onSelect={() => go("/")}>
            <CornerDownRight />
            <span>Home</span>
          </CommandItem>
          {PRIMARY_NAV.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.href} ${item.hint}`}
              onSelect={() => go(item.href)}
            >
              <CornerDownRight />
              <span>{item.label}</span>
              <span className="ml-auto text-xs text-ink-faint">{item.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Open in playground">
          {EXAMPLE_ITEMS.map((example) => (
            <CommandItem
              key={example.id}
              value={`load ${example.label} ${example.reading} playground`}
              onSelect={() => go(`/playground?example=${example.id}` as Route)}
            >
              <FileCode2 />
              <span>Load {example.label.toLowerCase()}</span>
              <span className="ml-auto font-mono text-xs text-ink-faint">{example.reading}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
