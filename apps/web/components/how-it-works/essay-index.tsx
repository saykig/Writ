"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * EssayIndex — the sticky reading rail for the How-it-works monograph in the
 * Writ paper palette. A single-level list of section links with:
 *   • a scroll-progress spine (a hairline whose filled portion tracks how far
 *     the reader has come), and
 *   • an active-section highlight recomputed from live geometry and nudged by an
 *     IntersectionObserver as sections cross the top of the reading column.
 *
 * Gold is reserved for genuine judgment moments elsewhere on the page, so the
 * rail stays in ink tones: the active dot fills with ink, reached dots take a
 * soft ink, the spine fills from ink-faint into rule. Hidden below ~900px.
 */

export interface EssaySection {
  readonly id: string;
  readonly title: string;
}

// Clears the 56px sticky header plus a little air (used as the IO top margin).
const HEADER_OFFSET = 80;

// The reading line: a section becomes active once its heading crosses this many
// pixels below the viewport top. Sits just under the sticky header.
const ACTIVE_LINE = 150;

export function EssayIndex({
  sections,
  note,
  updated,
}: {
  sections: readonly EssaySection[];
  note?: string;
  updated?: string;
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  // A single recompute drives both the progress spine and the active section.
  // It reads live geometry, so it is correct however it is triggered: a scroll
  // or resize event, or an IntersectionObserver crossing. The active section is
  // the last one whose heading has passed the reading line under the header,
  // which leaves no dead zone between sections.
  useEffect(() => {
    const pickActive = () => {
      let current = sections[0]?.id ?? "";
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE) current = section.id;
      }
      return current;
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
      setActiveId(pickActive());
    };
    const schedule = () => {
      if (raf === 0) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // IntersectionObserver nudges a recompute as sections cross the top band,
    // catching changes between scroll frames; the math above stays the source
    // of truth, so the two never disagree.
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(schedule, {
        rootMargin: `-${HEADER_OFFSET}px 0px -68% 0px`,
        threshold: [0, 1],
      });
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) observer.observe(el);
      }
    }

    return () => {
      if (raf !== 0) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [sections]);

  const activeIndex = useMemo(
    () => sections.findIndex((section) => section.id === activeId),
    [sections, activeId],
  );

  return (
    <aside
      className="sticky top-20 hidden self-start min-[900px]:block"
      aria-label="Sections of this reading"
    >
      {note ? (
        <p className="mb-8 max-w-[22ch] text-[0.8rem] leading-[1.55] text-ink-muted">{note}</p>
      ) : null}

      <nav className="relative grid gap-0.5" aria-label="Sections">
        <span
          aria-hidden
          className="pointer-events-none absolute top-7 bottom-7 left-[0.29rem] w-px -translate-x-1/2"
          style={
            {
              background: `linear-gradient(to bottom, var(--ink-faint) 0%, var(--ink-faint) ${progress * 100}%, var(--rule) ${progress * 100}%, var(--rule) 100%)`,
            } as CSSProperties
          }
        />
        {sections.map((section, i) => {
          const active = section.id === activeId;
          const reached = activeIndex >= 0 && i <= activeIndex;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "group relative grid min-h-[3.4rem] grid-cols-[0.58rem_minmax(0,1fr)] items-center gap-2.5 text-[0.8rem] leading-[1.25] transition-colors duration-200",
                active ? "text-foreground" : "text-ink-muted hover:text-ink-soft",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "relative z-10 size-[0.44rem] justify-self-center rounded-full border transition-all duration-300",
                  active
                    ? "scale-[1.34] border-foreground bg-foreground"
                    : reached
                      ? "border-ink-faint bg-ink-faint/50"
                      : "border-rule bg-paper",
                )}
                style={{ boxShadow: "0 0 0 2px var(--paper)" }}
              />
              <span className="[text-wrap:balance]">{section.title}</span>
            </a>
          );
        })}
      </nav>

      <div className="mt-8 flex flex-col gap-2 border-t border-rule pt-5">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 text-left text-[0.72rem] text-ink-soft transition-colors hover:text-foreground"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path
              d="M7 1.4v7.2M4 5.6 7 8.7l3-3.1"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 10.2v1.3c0 .6.5 1.1 1.1 1.1h7.8c.6 0 1.1-.5 1.1-1.1v-1.3"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
          Print this reading
        </button>
        {updated ? (
          <p className="text-[0.66rem] tracking-[0.01em] text-ink-faint">Updated {updated}</p>
        ) : null}
      </div>
    </aside>
  );
}
