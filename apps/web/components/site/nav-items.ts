/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

/**
 * Four destinations in the order a first-time reader needs them: understand
 * the system, get an answer, make a record, then inspect the mechanism.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/start-here", label: "Start Here", hint: "Follow one source to a traced answer" },
  { href: "/query", label: "Query", hint: "Ask across the reviewed corpora" },
  { href: "/build", label: "Build", hint: "Turn a source passage into a record" },
  { href: "/lab", label: "Lab", hint: "See how one passage becomes one record" },
];

/**
 * Start Here now carries the complete explanation, so the footer mirrors the
 * same four destinations without introducing a competing reading route.
 */
export const FOOTER_NAV: readonly NavItem[] = [...PRIMARY_NAV];

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
