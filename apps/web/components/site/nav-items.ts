/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

/**
 * The header. Three destinations, one per question a visitor actually arrives
 * with: can I try it, has it been used on something real, and how does it work.
 *
 * The Writ Lab, Methodologies, and Receipts are tools you reach *from* that
 * work rather than things you choose between on arrival, so they live in
 * `SECONDARY_NAV` — still one keystroke away in ⌘K, and still in the footer.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    href: "/policy-test/eu-us-ai-evaluation" as Route,
    label: "Policy Test",
    hint: "Run a reviewed policy question end to end",
  },
  { href: "/benchmark", label: "Benchmark", hint: "The 2025 G7 discrepancy ledger" },
  { href: "/how-it-works", label: "How it works", hint: "The language, engine, and evidence" },
];

/** Reachable from the command menu and the footer, but not the header. */
export const SECONDARY_NAV: readonly NavItem[] = [
  { href: "/playground", label: "Writ Lab", hint: "Compile, analyze, evaluate live" },
  {
    href: "/methodologies" as Route,
    label: "Methodologies",
    hint: "Source, structure, and diagnostics",
  },
  { href: "/receipts" as Route, label: "Receipts", hint: "How each assessment was reached" },
];

export const RESEARCH_NAV: readonly NavItem[] = [
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
