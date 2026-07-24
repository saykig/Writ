"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Arms an element after hydration, then reveals it once when it enters the
 * viewport. Content is visible before JavaScript runs, and reduced-motion users
 * never receive the entrance transition.
 */
export function useInView<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [status, setStatus] = React.useState<"idle" | "armed" | "in">("idle");

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let armFrame = 0;
    let revealFrame = 0;
    let observer: IntersectionObserver | undefined;

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      armFrame = window.requestAnimationFrame(() => setStatus("in"));
      return () => window.cancelAnimationFrame(armFrame);
    }

    armFrame = window.requestAnimationFrame(() => {
      setStatus("armed");
      const rect = el.getBoundingClientRect();

      if (rect.top < window.innerHeight && rect.bottom > 0) {
        revealFrame = window.requestAnimationFrame(() => setStatus("in"));
        return;
      }

      observer = new IntersectionObserver(
        (entries, activeObserver) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setStatus("in");
              activeObserver.disconnect();
              break;
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
      );
      observer.observe(el);
    });

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(armFrame);
      window.cancelAnimationFrame(revealFrame);
    };
  }, []);

  return { ref, armed: status !== "idle", inView: status === "in" };
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
  const { ref, armed, inView } = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={cn("reveal", armed && "is-armed", inView && "is-in", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
