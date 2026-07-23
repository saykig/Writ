"use client";

import { useEffect, useRef, useState } from "react";

/**
 * NumberTicker — an animated count-up that eases from 0 to `value` once it
 * scrolls into view. Interval-based (fires reliably even when the tab is not
 * painting) and reduced-motion-safe: it shows the final value immediately when
 * reduced motion is requested. A safety timer guarantees it never sticks at 0.
 */
export function NumberTicker({
  value,
  className,
  durationMs = 900,
}: {
  value: number;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Defer through a macrotask so this is never a synchronous setState in the
      // effect body (react-hooks/set-state-in-effect); shows the final value at once.
      const settle = window.setTimeout(() => setDisplay(value), 0);
      return () => clearTimeout(settle);
    }

    let timer: number | undefined;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const start = Date.now();
      timer = window.setInterval(() => {
        const t = Math.min(1, (Date.now() - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(eased * value));
        if (t >= 1) {
          if (timer) clearInterval(timer);
          setDisplay(value);
        }
      }, 16);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    const safety = window.setTimeout(run, 700);

    return () => {
      io.disconnect();
      clearTimeout(safety);
      if (timer) clearInterval(timer);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
