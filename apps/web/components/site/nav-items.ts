/** Shared route + example constants for the nav and the ⌘K command menu. */

import type { Route } from "next";

export interface NavItem {
  readonly href: Route;
  readonly label: string;
  readonly hint: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/how-it-works", label: "How it works", hint: "The pipeline, end to end" },
  { href: "/playground", label: "Playground", hint: "Compile, analyze, evaluate live" },
  { href: "/benchmark", label: "Benchmark", hint: "The 2025 G7 discrepancy ledger" },
  { href: "/methodologies", label: "Methodologies", hint: "Rubrics compiled to canonical IR" },
  { href: "/governance", label: "Governance", hint: "Frozen, reviewed evidence" },
  { href: "/conformance", label: "Conformance", hint: "Cross-implementation semantics" },
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

export const GITHUB_URL = "https://github.com/williamjblair/covenant";
