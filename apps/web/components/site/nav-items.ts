/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

/**
 * The whole site: the answer, the workbench that produced it, and the reading
 * that explains what producing it means. The homepage carries the rest.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/demo", label: "Demo", hint: "One question, answered from the law" },
  { href: "/lab", label: "Writ Lab", hint: "Inspect queries, records, choices, and traces" },
  { href: "/how-it-works", label: "How it works", hint: "The language, engine, and evidence" },
];

export interface ExampleItem {
  readonly id: "reviewed" | "any-actor" | "broad-conduct" | "incomplete";
  readonly label: string;
  readonly reading: string;
}

export const EXAMPLE_ITEMS: readonly ExampleItem[] = [
  { id: "reviewed", label: "The reviewed rule", reading: "all four conditions" },
  {
    id: "any-actor",
    label: "Any organization, any force",
    reading: "drops binding, drops provider",
  },
  { id: "broad-conduct", label: "Any duty near evaluation", reading: "drops model evaluation" },
  { id: "incomplete", label: "A band left out", reading: "no rule for the empty case" },
];

export const GITHUB_URL = "https://github.com/saykig/Writ";
