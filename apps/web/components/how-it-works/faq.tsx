"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "What is Writ, in one sentence?",
    a: "A compiler for policy scoring: you write a scoring rubric as a program, and Writ catches ambiguity before any evidence, scores it against a frozen, reviewed record, and returns every number as a receipt anyone can recompute.",
  },
  {
    q: "Does it automate the judgment?",
    a: "No — and that is the honest claim. Gathering evidence, translating the rubric, and choosing the interpretation are human work. Writ makes those judgments explicit and their consequences reproducible; it does not make the call for you.",
  },
  {
    q: "Why four truth values instead of true and false?",
    a: "Because evidence is often incomplete or conflicting. Writ keeps “unknown” and “contested” distinct from “false”, so a missing fact never silently becomes a failing score — the result stays honestly unresolved rather than guessed.",
  },
  {
    q: "What does “reproducible” actually mean here?",
    a: "Every score is content-hashed. Anyone with the same frozen evidence recomputes the same number and the same hash; change a single quote and the hash changes. The score carries its own proof.",
  },
  {
    q: "What is the IR?",
    a: "The intermediate representation — the normalized, typed program a rubric compiles to. The evaluator and the analyzer reason over the IR, not the surface text, so the same methodology behaves identically everywhere.",
  },
  {
    q: "Can it handle more than pass/fail scoring?",
    a: "Yes. Beyond the G7 three-point scale, it expresses weighted-ordinal indices — the AI-governance Gap Matrix is scored that way, with an axis left honestly pending rather than collapsed to zero.",
  },
];

export function Faq() {
  return (
    <Accordion className="border-t border-border">
      {ITEMS.map((item, index) => (
        <AccordionItem key={index} value={`faq-${index}`}>
          <AccordionTrigger className="text-[0.95rem] hover:no-underline">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="max-w-[60ch] text-[0.9rem] leading-relaxed text-muted-foreground">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
