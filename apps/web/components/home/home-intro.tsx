"use client";

import type { CSSProperties, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CorpusCoverageGlobe } from "@/components/pilot/corpus-coverage-globe";
import { Button } from "@/components/ui/button";
import { CORPUS_COVERAGE } from "@/lib/corpus-coverage";

const HEADLINE = "Write in Writ.";
const SETTLE_DELAYS = [
  980, 1440, 1120, 1580, 1260, 1510, 1060, 1360, 1180, 1490, 1020, 1320, 1550, 1680,
];
const FIELD_SYMBOLS = ["0", "1", "●", "■", "▲", "—", "+", "·"] as const;

const ENCODED_FIELD = Array.from({ length: 864 }, (_, index) => {
  const column = index % 36;
  const row = Math.floor(index / 36);
  return {
    symbol: FIELD_SYMBOLS[(index * 5 + row * 3) % FIELD_SYMBOLS.length],
    x: 0.6 + column * 2.78 + ((row * 7 + index) % 5) * 0.12,
    y: 0.8 + row * 4.2 + ((column * 11 + index) % 4) * 0.16,
    opacity: 0.13 + ((index * 13 + row) % 25) / 100,
    pulseDelay: (index % 17) * 43,
  };
});

type IntroPhase = "encoded" | "resolved" | "reconstructing" | "complete";
type MotionStyle = CSSProperties & Record<string, string | number | undefined>;

function EncodedField() {
  return (
    <div className="home-encoded-field" aria-hidden>
      {ENCODED_FIELD.map((mark, index) => (
        <span
          key={`${mark.symbol}-${index}`}
          data-shape={mark.symbol}
          style={
            {
              "--field-x": `${mark.x}%`,
              "--field-y": `${mark.y}%`,
              "--field-opacity": mark.opacity,
              "--field-delay": `${mark.pulseDelay}ms`,
            } as MotionStyle
          }
        >
          {mark.symbol}
        </span>
      ))}
    </div>
  );
}

function IntroTitle({ titleRef }: { titleRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={titleRef} className="home-intro-title" aria-hidden>
      <span className="home-intro-title-characters">
        {Array.from(HEADLINE).map((character, index) => (
          <span
            className="home-intro-character"
            key={`${character}-${index}`}
            style={{ "--settle-delay": `${SETTLE_DELAYS[index] ?? 1500}ms` } as MotionStyle}
          >
            <span className="home-intro-character-measure">
              {character === " " ? "\u00a0" : character}
            </span>
            {character === " " ? null : (
              <span className="home-intro-character-pixel">{character}</span>
            )}
            <span className="home-intro-character-final">
              {character === " " ? "\u00a0" : character}
            </span>
          </span>
        ))}
      </span>
      <span className="home-intro-caret">▌</span>
      <span className="home-intro-fragments" aria-hidden />
    </div>
  );
}

export function HomepageHero() {
  const [phase, setPhase] = useState<IntroPhase>("encoded");
  const introTitleRef = useRef<HTMLDivElement>(null);
  const finalTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = window.requestAnimationFrame(() => setPhase("complete"));
      return () => window.cancelAnimationFrame(frame);
    }

    const resolved = window.setTimeout(() => setPhase("resolved"), 2150);
    const reconstructing = window.setTimeout(() => setPhase("reconstructing"), 3150);
    const complete = window.setTimeout(() => setPhase("complete"), 4480);
    return () => {
      window.clearTimeout(resolved);
      window.clearTimeout(reconstructing);
      window.clearTimeout(complete);
    };
  }, []);

  useEffect(() => {
    if (phase !== "reconstructing") return;
    const introTitle = introTitleRef.current;
    const finalTitle = finalTitleRef.current;
    if (!introTitle || !finalTitle) return;

    const from = introTitle.getBoundingClientRect();
    const to = finalTitle.getBoundingClientRect();
    const translateX = to.left - from.left;
    const translateY = to.top - from.top;
    const scale = Math.min(to.width / from.width, to.height / from.height);

    const animation = introTitle.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0)", opacity: 1 },
        {
          offset: 0.38,
          transform: `translate3d(${translateX * 0.32}px, ${translateY * 0.28}px, 0) scale(${0.82 + scale * 0.18})`,
          filter: "blur(0.7px)",
          opacity: 0.92,
        },
        {
          offset: 0.72,
          transform: `translate3d(${translateX * 0.78}px, ${translateY * 0.8}px, 0) scale(${scale * 1.08})`,
          filter: "blur(1.4px)",
          opacity: 0.64,
        },
        {
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          filter: "blur(0)",
          opacity: 0,
        },
      ],
      { duration: 1180, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );

    return () => animation.cancel();
  }, [phase]);

  return (
    <section className="home-intro" data-intro-phase={phase} aria-labelledby="home-title">
      {phase === "complete" ? null : (
        <div className="home-prehero" aria-hidden>
          <EncodedField />
          <IntroTitle titleRef={introTitleRef} />
        </div>
      )}

      <div className="home-final-interface">
        <div className="home-final-grid">
          <div className="home-final-copy">
            <h1 ref={finalTitleRef} id="home-title" className="home-final-title">
              {HEADLINE}
            </h1>
            <p className="home-final-description">
              Writ turns complex political and institutional information into structured, reviewable
              knowledge. Ask questions, build a corpus, and trace every conclusion back to its
              source.
            </p>
            <div className="home-final-actions">
              <Button
                size="lg"
                className="text-[0.78rem] sm:text-[0.82rem]"
                nativeButton={false}
                render={
                  <Link href="/query">
                    Ask a question
                    <ArrowRight />
                  </Link>
                }
              />
              <Button
                variant="outline"
                size="lg"
                nativeButton={false}
                render={<Link href="/build">Build a corpus</Link>}
              />
              <Button
                variant="ghost"
                size="lg"
                nativeButton={false}
                render={<Link href="/lab">See how Writ works</Link>}
              />
            </div>
          </div>

          <div className="home-final-globe">
            <CorpusCoverageGlobe coverage={CORPUS_COVERAGE} />
            {phase === "reconstructing" ? (
              <div className="home-globe-reconstruction" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
