"use client";

import type { CSSProperties } from "react";
import type { MotionValue } from "motion/react";
import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";

const FIELD_SYMBOLS = Array.from(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-/<>[]{}#@%&=·—",
);

const FIELD_MARKS = Array.from({ length: 960 }, (_, index) => {
  const column = index % 48;
  const row = Math.floor(index / 48);
  const xJitter = (((index * 13 + row * 7) % 11) - 5) * 0.16;
  const yJitter = (((column * 11 + index * 3) % 13) - 6) * 0.26;
  const x = 0.55 + column * 2.1 + xJitter + Math.sin(row * 1.83) * 0.42;
  const y = 0.65 + row * 5.18 + yJitter + Math.sin(column * 2.17) * 0.68;
  const chord = Math.floor(index / 30);
  const chordStep = index % 30;
  const chordAngle = (((chord * 47) % 180) * Math.PI) / 180;
  const chordOffset = ((((chord * 11) % 31) / 30) * 1.5 - 0.75) * 0.92;
  const chordHalfLength = Math.sqrt(1 - chordOffset ** 2);
  const chordProgress = (chordStep / 29) * 2 - 1;
  const brokenLineNudge = chordStep % 8 === 0 ? ((chord % 3) - 1) * 0.045 : 0;
  const alongChord = chordProgress * chordHalfLength + brokenLineNudge;
  const isLooseEdge = chordStep < 2 || chordStep > 27;
  const edgeFlight = isLooseEdge ? 1.1 + ((chord * 7 + chordStep) % 7) * 0.055 : 1;
  const chordLooseness = 0.9 + ((chord * 13) % 9) * 0.025;
  const clusterX =
    (alongChord * Math.cos(chordAngle) - chordOffset * Math.sin(chordAngle)) *
      11.2 *
      edgeFlight *
      chordLooseness +
    Math.sin(chord * 1.7) * 0.9;
  const clusterY =
    (alongChord * Math.sin(chordAngle) + chordOffset * Math.cos(chordAngle)) *
      15.5 *
      edgeFlight *
      chordLooseness +
    Math.cos(chord * 1.3) * 1.15;
  const originX = 50 - x + clusterX;
  const originY = 50 - y + clusterY;
  const escapeFactor = 0.48 + ((index * 7) % 6) * 0.075;
  const escapeX = originX * escapeFactor + Math.cos(chordAngle * 2.7) * 1.15;
  const escapeY = originY * escapeFactor + Math.sin(chordAngle * 2.3) * 1.45;
  const emissionFactor = index % 37 === 0 ? 0.12 : 0.025 + ((index * 5) % 6) * 0.006;
  const orbitFactor = index % 37 === 0 ? 0.085 : 0.018 + ((index * 3) % 5) * 0.005;

  return {
    id: `field-${row}-${column}`,
    symbol: FIELD_SYMBOLS[(index * 17 + row * 29 + column * 7) % FIELD_SYMBOLS.length],
    x,
    y,
    escapeX,
    escapeY,
    emissionX: clusterX * emissionFactor,
    emissionY: clusterY * emissionFactor,
    orbitX: -clusterY * orbitFactor,
    orbitY: clusterX * orbitFactor,
    emissionDuration: 3.8 + ((index * 17) % 29) / 10,
    emissionDelay: -((index * 13) % 31) / 10,
    originX,
    originY,
    opacity: 0.12 + ((index * 11 + row * 7) % 23) / 100,
  };
});

type FieldStyle = CSSProperties & Record<string, string | number>;
type SwarmStyle = CSSProperties & { "--emission-strength": MotionValue<number> };

/** One persistent encoded field shared by the hero and corpus prototype. */
export function HomepageField() {
  const [corpusReached, setCorpusReached] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.19, 0.38, 0.58, 0.7, 0.78, 0.8],
    [0.82, 0.72, 0.54, 0.36, 0.2, 0.05, 0],
  );
  const emissionStrength = useTransform(scrollY, [0, 300, 1600, 3200], [1, 0.72, 0.48, 0.3]);

  useEffect(() => {
    const corpusStage = document.querySelector(".corpus-prototype-stage");
    if (!corpusStage) return;

    const updateCorpusCutoff = () => {
      const bounds = corpusStage.getBoundingClientRect();
      setCorpusReached(bounds.top <= window.innerHeight);
    };

    const observer = new IntersectionObserver(updateCorpusCutoff);

    observer.observe(corpusStage);
    updateCorpusCutoff();
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className="homepage-field"
      data-corpus-reached={corpusReached ? "true" : "false"}
      style={corpusReached ? { opacity: 0 } : { opacity }}
      aria-hidden
    >
      <motion.div
        className="homepage-field-swarm"
        style={{ "--emission-strength": emissionStrength } as SwarmStyle}
      >
        {FIELD_MARKS.map((mark) => (
          <span
            key={mark.id}
            data-symbol={mark.symbol}
            style={
              {
                "--field-x": `${mark.x.toFixed(5)}%`,
                "--field-y": `${mark.y.toFixed(5)}%`,
                "--field-opacity": mark.opacity.toFixed(2),
                "--field-origin-x": `${mark.originX.toFixed(6)}vw`,
                "--field-origin-y": `${mark.originY.toFixed(6)}vh`,
                "--field-mid-x": `${mark.escapeX.toFixed(6)}vw`,
                "--field-mid-y": `${mark.escapeY.toFixed(6)}vh`,
                "--field-near-x": `${(mark.originX * 0.16).toFixed(6)}vw`,
                "--field-near-y": `${(mark.originY * 0.16).toFixed(6)}vh`,
                "--field-emission-x": `${mark.emissionX.toFixed(6)}vw`,
                "--field-emission-y": `${mark.emissionY.toFixed(6)}vh`,
                "--field-orbit-x": `${mark.orbitX.toFixed(6)}vw`,
                "--field-orbit-y": `${mark.orbitY.toFixed(6)}vh`,
                "--field-emission-duration": `${mark.emissionDuration.toFixed(1)}s`,
                "--field-emission-delay": `${mark.emissionDelay.toFixed(1)}s`,
              } as FieldStyle
            }
          >
            <i>{mark.symbol}</i>
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}
