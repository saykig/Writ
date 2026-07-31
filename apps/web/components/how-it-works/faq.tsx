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
    a: "A source-grounded knowledge system and domain-specific language for political science and global affairs: questions run across versioned corpora, and every derived judgment remains traceable to reviewed evidence.",
  },
  {
    q: "Does it automate the judgment?",
    a: "No — and that is the honest claim. Gathering evidence, translating the rubric, and choosing the interpretation are human work. Writ makes those judgments explicit and their consequences reproducible; it does not make the call for you.",
  },
  {
    q: "Why four truth values instead of true and false?",
    a: "Because evidence is often incomplete or conflicting. Writ keeps “unknown” and “contested” distinct from “false”, so a missing fact never silently becomes a negative result — the result stays honestly unresolved rather than guessed.",
  },
  {
    q: "What does “reproducible” actually mean here?",
    a: "Every Writ-derived result declares its methodology, version, inputs, and trace. Anyone with the same frozen evidence recomputes the same result and hash; change a single quote and the hash changes.",
  },
  {
    q: "What is the IR?",
    a: "The intermediate representation — the normalized, typed program a rubric compiles to. The evaluator and the analyzer reason over the IR, not the surface text, so the same methodology behaves identically everywhere.",
  },
  {
    q: "Can a methodology use more than a yes/no result?",
    a: "Yes. A declared analysis can use a three-point scale or weighted-ordinal measure while keeping an incompletely assessed value pending rather than collapsing it to zero.",
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
