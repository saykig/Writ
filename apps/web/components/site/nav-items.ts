/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/playground", label: "Playground", hint: "Compile, analyze, evaluate live" },
  {
    href: "/methodologies" as Route,
    label: "Methodologies",
    hint: "Source, structure, and diagnostics",
  },
  { href: "/receipts" as Route, label: "Receipts", hint: "How each assessment was reached" },
  { href: "/how-it-works", label: "How it works", hint: "The language, engine, and evidence" },
];

export const RESEARCH_NAV: readonly NavItem[] = [
  { href: "/benchmark", label: "G7 benchmark", hint: "The 2025 G7 discrepancy ledger" },
  { href: "/gap-matrix", label: "Gap Matrix", hint: "A second methodology: AI governance" },
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
