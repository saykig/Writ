"use client";

/**
 * The record in ordinary words, on the right.
 *
 * Two voices, kept visually apart and marked in the DOM. A line derived from the
 * record is set in the reading face; a line written for this interface is set
 * quieter and labelled as such, because an explanation is not evidence and must
 * never be mistaken for the reviewers' own judgment.
 *
 * Hovering or focusing a section lights the fields it is about — in the passage,
 * in the structured record, and in the code view.
 */

import type { ExplanationSection } from "@/lib/lab-explanation";
import type { RecordFieldKey } from "@/lib/record-view";
import { cn } from "@/lib/utils";

export function RecordExplanation({
  sections,
  activeSection,
  onFocusSection,
  className,
}: {
  sections: readonly ExplanationSection[];
  activeSection: string | null;
  onFocusSection: (id: string | null, fields: readonly RecordFieldKey[]) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {sections.map((section) => {
        const active = activeSection === section.id;
        const interactive = section.fields.length > 0;
        return (
          <section
            key={section.id}
            tabIndex={interactive ? 0 : -1}
            aria-label={interactive ? `${section.heading} — highlights the record` : undefined}
            onMouseEnter={
              interactive ? () => onFocusSection(section.id, section.fields) : undefined
            }
            onMouseLeave={interactive ? () => onFocusSection(null, []) : undefined}
            onFocus={interactive ? () => onFocusSection(section.id, section.fields) : undefined}
            onBlur={interactive ? () => onFocusSection(null, []) : undefined}
            className={cn(
              "rounded-md px-3 py-3 transition-colors motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              interactive && "cursor-default",
              active && "bg-muted/50",
            )}
          >
            <h3 className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
              {section.heading}
            </h3>
            <div className="mt-1.5 space-y-2">
              {section.lines.map((line, index) => (
                <p
                  key={index}
                  data-origin={line.origin}
                  className={cn(
                    "text-[0.86rem] leading-7",
                    line.origin === "record"
                      ? "text-foreground/90"
                      : "border-l border-border/70 pl-3 text-muted-foreground",
                  )}
                >
                  {line.text}
                </p>
              ))}
            </div>
            {section.lines.some((line) => line.origin === "editorial") ? (
              <p className="mt-2 pl-3 text-[0.68rem] text-muted-foreground/70">
                Indented lines are written for this interface, not recorded evidence.
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
