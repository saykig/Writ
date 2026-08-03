/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

/**
 * Three destinations for three intentions: get an answer, make a record,
 * understand how a passage becomes one. The homepage carries the rest.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/query", label: "Query", hint: "Ask across the reviewed corpora" },
  { href: "/build", label: "Build", hint: "Turn a source passage into a record" },
  { href: "/lab", label: "Lab", hint: "See how one passage becomes one record" },
];

/**
 * The footer also carries How it works. It is a reading rather than a place to
 * work, so it stays out of the primary nav without becoming unreachable.
 */
export const FOOTER_NAV: readonly NavItem[] = [
  ...PRIMARY_NAV,
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
