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
    let raf = 0;
    // Defer through rAF so the reveal is never a synchronous setState in the
    // effect body (react-hooks/set-state-in-effect); the IO callback below is
    // already async.
    const revealSoon = () => {
      raf = requestAnimationFrame(() => setInView(true));
    };
    if (typeof IntersectionObserver === "undefined") {
      revealSoon();
      return () => cancelAnimationFrame(raf);
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      revealSoon();
      return () => cancelAnimationFrame(raf);
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
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
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
