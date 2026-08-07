"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CorpusCoverageGlobe } from "@/components/pilot/corpus-coverage-globe";
import { Button } from "@/components/ui/button";
import { CORPUS_COVERAGE } from "@/lib/corpus-coverage";

const HEADLINE = "Write in Writ.";
const LOCK_DELAYS = [350, 460, 570, 680, 790, 830, 960, 1080, 1120, 1240, 1370, 1460, 1540, 1680];
const FIELD_SYMBOLS = ["0", "1", "+", "×", "▪", "●", "—"] as const;

const AMBIENT_MARKS = Array.from({ length: 84 }, (_, index) => ({
  symbol: FIELD_SYMBOLS[(index * 5 + 2) % FIELD_SYMBOLS.length],
  x: 2 + ((index * 37) % 96),
  y: 3 + ((index * 53) % 92),
  opacity: 0.14 + ((index * 11) % 18) / 100,
  delay: (index % 9) * 70,
}));

type MotionStyle = CSSProperties & Record<string, string | number | undefined>;

function PixelField() {
  return (
    <div className="home-pixel-field" aria-hidden>
      {AMBIENT_MARKS.map((mark, index) => (
        <span
          key={`${mark.symbol}-${index}`}
          style={
            {
              "--field-x": `${mark.x}%`,
              "--field-y": `${mark.y}%`,
              "--field-opacity": mark.opacity,
              "--field-delay": `${mark.delay}ms`,
            } as MotionStyle
          }
        >
          {mark.symbol}
        </span>
      ))}
    </div>
  );
}

function DecodeHeadline() {
  return (
    <h1
      id="home-title"
      className="home-decode-title whitespace-nowrap text-[length:var(--t-hero)] leading-[0.98] font-semibold tracking-[-0.04em]"
      aria-label={HEADLINE}
    >
      <span className="sr-only">{HEADLINE}</span>
      <span className="home-decode-visual" aria-hidden>
        {Array.from(HEADLINE).map((character, index) => {
          const lockDelay = LOCK_DELAYS[index] ?? LOCK_DELAYS.at(-1) ?? 1680;
          const cycleDuration = 150 + Math.round((index / (HEADLINE.length - 1)) ** 2 * 290);
          return (
            <span
              className="home-decode-character"
              key={`${character}-${index}`}
              style={
                {
                  "--lock-delay": `${lockDelay}ms`,
                  "--cycle-duration": `${cycleDuration}ms`,
                } as MotionStyle
              }
            >
              <span className="home-character-measure">
                {character === " " ? "\u00a0" : character}
              </span>
              {character === " " ? null : <span className="home-character-pixel">{character}</span>}
              <span className="home-character-final">
                {character === " " ? "\u00a0" : character}
              </span>
            </span>
          );
        })}
      </span>
    </h1>
  );
}

export function HomepageHero() {
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    const completion = window.setTimeout(() => setIntroComplete(true), 2450);
    return () => window.clearTimeout(completion);
  }, []);

  return (
    <section
      className="home-intro relative isolate min-h-[calc(100svh-4.5rem)]"
      data-intro={introComplete ? "complete" : "running"}
      aria-labelledby="home-title"
    >
      {introComplete ? <div className="home-static-field" aria-hidden /> : <PixelField />}

      <div className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-[76rem] items-center gap-4 px-5 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(30rem,1.12fr)] lg:py-8">
        <div className="relative z-10 py-4 lg:py-10">
          <DecodeHeadline />
          <p className="home-resolve-copy mt-7 max-w-[36rem] text-[length:var(--t-lead)] leading-8 text-muted-foreground text-pretty">
            Writ turns complex political and institutional information into structured, reviewable
            knowledge. Ask questions, build a corpus, and trace every conclusion back to its source.
          </p>
          <div className="home-resolve-actions mt-9 flex flex-wrap gap-3">
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

        <div className="home-resolve-globe mx-auto w-full min-w-0 max-w-[42rem] lg:justify-self-end">
          <CorpusCoverageGlobe coverage={CORPUS_COVERAGE} />
          {introComplete ? null : <div className="home-globe-pixel-mask" aria-hidden />}
        </div>
      </div>
    </section>
  );
}
