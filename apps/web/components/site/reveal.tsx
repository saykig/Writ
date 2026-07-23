"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Adds an `is-in` reveal once the element scrolls into view, then stops (ported
 * from ~/personal/cepheus/app/components/use-in-view.ts). Purely an enhancement:
 * the `.reveal` class shows content at rest if the observer never fires, and the
 * global `prefers-reduced-motion` block disables the entrance motion.
 */
export function useInView<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    // Defer through a macrotask so the reveal is never a synchronous setState in
    // the effect body (react-hooks/set-state-in-effect). setTimeout (not rAF) is
    // deliberate: it still fires when the tab is backgrounded or not painting, so
    // `.reveal` content can never get stranded at opacity 0.
    const revealSoon = () => {
      timer = window.setTimeout(() => setInView(true), 0);
    };
    if (typeof IntersectionObserver === "undefined") {
      revealSoon();
      return () => clearTimeout(timer);
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      revealSoon();
      return () => clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -64px 0px", threshold: 0 },
    );
    io.observe(el);
    // Safety net: if the observer never fires (throttled rAF-based impls, odd
    // viewports), reveal after a short delay so content is never left hidden.
    timer = window.setTimeout(() => {
      setInView(true);
      io.disconnect();
    }, 1200);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return { ref, inView };
}

/** A block that fades/rises in once when scrolled into view. */
export function Reveal({
  children,
  className,
  delay,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={cn("reveal", inView && "is-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
