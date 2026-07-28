/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

/**
 * The whole site: the Lab, where a methodology is written and run, and the
 * reading that explains what running it means. The homepage carries the rest.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/playground", label: "Writ Lab", hint: "Compile, analyze, evaluate live" },
  { href: "/how-it-works", label: "How it works", hint: "The language, engine, and evidence" },
];

export interface ExampleItem {
  readonly id: "literal" | "resolved" | "inclusive";
  readonly label: string;
  readonly reading: string;
}

export const EXAMPLE_ITEMS: readonly ExampleItem[] = [
  { id: "literal", label: "Literal reading", reading: "up to four → 1–4 strong" },
  { id: "resolved", label: "Resolved reading", reading: "exhaustive, counter-precedence" },
  { id: "inclusive", label: "Inclusive reading", reading: "up to four → 0–4 strong" },
];

export const GITHUB_URL = "https://github.com/saykig/Writ";
