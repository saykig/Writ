"use client";

import type { CSSProperties } from "react";
import type { MotionValue } from "motion/react";
import { useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";

import { CorpusCoverageGlobe } from "@/components/pilot/corpus-coverage-globe";
import { Button } from "@/components/ui/button";
import { CORPUS_COVERAGE } from "@/lib/corpus-coverage";

const HEADLINE = "Write in Writ.";
const STATEMENT =
  "Writ turns complex political and institutional information into structured, reviewable knowledge. Ask questions, build a corpus, and trace every conclusion back to its source.";
const STATEMENT_LINES = [
  "Writ turns complex political and",
  "institutional information into structured,",
  "reviewable knowledge.",
  "Ask questions, build a corpus, and trace every",
  "conclusion back to its source.",
] as const;
const FRAGMENT_SYMBOLS = ["01", "+", "−", "{", "}", "R", "/", "<", ">", "W", "=", "[]"];

const GLOBE_FRAGMENTS = Array.from({ length: 42 }, (_, index) => {
  const angle = (((index * 137.5 + 11) % 360) * Math.PI) / 180;
  const radius = 43 + ((index * 7) % 6) * 1.55;
  const drift = 7 + ((index * 11) % 8) * 1.35;

  return {
    id: `globe-fragment-${index}`,
    symbol: FRAGMENT_SYMBOLS[(index * 5) % FRAGMENT_SYMBOLS.length],
    left: `${(50 + Math.cos(angle) * radius).toFixed(4)}%`,
    top: `${(50 + Math.sin(angle) * radius).toFixed(4)}%`,
    x: `${(Math.cos(angle) * drift).toFixed(4)}cqw`,
    y: `${(Math.sin(angle) * drift).toFixed(4)}cqw`,
    duration: `${(4.8 + ((index * 13) % 29) / 10).toFixed(1)}s`,
    delay: `${(-((index * 17) % 43) / 10).toFixed(1)}s`,
  };
});

type CharacterStyle = CSSProperties & {
  "--type-end": string;
  "--type-start": string;
};

type GlobeFragmentStyle = CSSProperties & {
  "--fragment-delay": string;
  "--fragment-duration": string;
  "--fragment-x": string;
  "--fragment-y": string;
};

function StatementLine({
  children,
  index,
  progress,
  reduceMotion,
}: {
  children: string;
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
}) {
  const start = 0.08 + index * 0.135;
  const end = start + 0.22;
  const clipPath = useTransform(progress, [start, end], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const opacity = useTransform(progress, [start, start + 0.055, end], [0, 0.68, 1]);
  const cursorLeft = useTransform(progress, [start, end], ["0%", "calc(100% + 0.08em)"]);
  const cursorOpacity = useTransform(
    progress,
    [start - 0.02, start, start + 0.025, end - 0.02, end + 0.035],
    [0, 1, 1, 1, 0],
  );

  return (
    <motion.span
      className="home-motion-statement-line"
      style={reduceMotion ? undefined : { clipPath, opacity }}
    >
      {children}
      <motion.span
        className="home-motion-statement-caret"
        style={reduceMotion ? { display: "none" } : { left: cursorLeft, opacity: cursorOpacity }}
        aria-hidden
      />
    </motion.span>
  );
}

function ResolvingTitle({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <h1
      id="home-title"
      className="home-motion-title"
      data-reduced-motion={reduceMotion ? "true" : undefined}
      aria-label={HEADLINE}
    >
      <span className="home-motion-title-characters" aria-hidden>
        {Array.from(HEADLINE).map((character, index) => {
          const printable = character === " " ? "\u00a0" : character;

          return (
            <span
              className="home-motion-character"
              key={`${character}-${index}`}
              style={
                {
                  "--type-start": `${30 + index * 3.5}svh`,
                  "--type-end": `${34 + index * 3.5}svh`,
                } as CharacterStyle
              }
            >
              <span className="home-motion-character-measure">{printable}</span>
              {character === " " ? null : (
                <span className="home-motion-character-pixel">{character}</span>
              )}
              <span className="home-motion-character-final">{printable}</span>
            </span>
          );
        })}
      </span>
      <span className="home-motion-caret" aria-hidden />
    </h1>
  );
}

export function HomepageHero() {
  const globeRef = useRef<HTMLDivElement>(null);
  const statementRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const globeInView = useInView(globeRef, { margin: "-8% 0px -8% 0px" });
  const { scrollYProgress: globeProgress } = useScroll({
    target: globeRef,
    offset: ["start 94%", "center 48%"],
  });
  const globeOpacity = useTransform(globeProgress, [0, 0.1, 0.48], [0, 0.38, 1]);
  const globeY = useTransform(globeProgress, [0, 0.44, 1], [80, 0, -18]);
  const globeFilter = useTransform(
    globeProgress,
    [0, 0.46, 0.84],
    ["blur(5px)", "blur(1px)", "blur(0px)"],
  );
  const { scrollYProgress: statementProgress } = useScroll({
    target: statementRef,
    offset: ["start 100%", "end 100%"],
  });
  const actionsOpacity = useTransform(statementProgress, [0.84, 0.92, 1], [0, 0.55, 1]);
  const actionsY = useTransform(statementProgress, [0.84, 1], [14, 0]);

  return (
    <section className="home-motion-hero" aria-labelledby="home-title">
      <div className="home-motion-title-scroll">
        <div className="home-motion-title-stage">
          <ResolvingTitle reduceMotion={reduceMotion} />
        </div>
      </div>

      <div ref={globeRef} className="home-motion-globe-stage" aria-label="Current corpus coverage">
        <div className="home-motion-globe-sticky">
          <motion.div
            className="home-motion-globe"
            style={
              reduceMotion ? undefined : { opacity: globeOpacity, y: globeY, filter: globeFilter }
            }
          >
            <div
              className="home-motion-globe-fragments"
              data-active={globeInView && !reduceMotion ? "true" : "false"}
              aria-hidden
            >
              {GLOBE_FRAGMENTS.map((fragment) => (
                <span
                  key={fragment.id}
                  style={
                    {
                      left: fragment.left,
                      top: fragment.top,
                      "--fragment-x": fragment.x,
                      "--fragment-y": fragment.y,
                      "--fragment-duration": fragment.duration,
                      "--fragment-delay": fragment.delay,
                    } as GlobeFragmentStyle
                  }
                >
                  {fragment.symbol}
                </span>
              ))}
            </div>
            <CorpusCoverageGlobe coverage={CORPUS_COVERAGE} className="home-motion-globe-object" />
          </motion.div>
        </div>
      </div>

      <div ref={statementRef} className="home-motion-statement-stage">
        <div className="home-motion-statement-sticky">
          <div className="home-motion-copy">
            <h2 className="home-motion-description" aria-label={STATEMENT}>
              {STATEMENT_LINES.map((line, index) => (
                <StatementLine
                  key={line}
                  index={index}
                  progress={statementProgress}
                  reduceMotion={reduceMotion}
                >
                  {line}
                </StatementLine>
              ))}
            </h2>
          </div>

          <motion.div
            className="home-motion-actions"
            style={reduceMotion ? undefined : { opacity: actionsOpacity, y: actionsY }}
          >
            <Button
              size="sm"
              className="home-motion-action home-motion-action--primary"
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
              size="sm"
              className="home-motion-action"
              nativeButton={false}
              render={<Link href="/build">Build a corpus</Link>}
            />
            <Button
              variant="ghost"
              size="sm"
              className="home-motion-action"
              nativeButton={false}
              render={<Link href="/start-here">See how Writ works</Link>}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
