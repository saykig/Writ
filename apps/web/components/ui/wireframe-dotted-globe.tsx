"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Geometry } from "geojson";

import { cn } from "@/lib/utils";

const LAND_DATA_URL = "/data/ne_110m_land.json";
const RESUME_DELAY_MS = 900;
const ROTATION_DEGREES_PER_SECOND = 1.6;
const DEFAULT_ROTATION: [number, number, number] = [-12, -18, 0];

export function clampLatitude(value: number): number {
  return Math.max(-72, Math.min(72, value));
}

function makeLandDots(land: FeatureCollection<Geometry>): [number, number][] {
  const dots: [number, number][] = [];
  for (let latitude = -84; latitude <= 84; latitude += 1.75) {
    const longitudeStep = Math.max(1.75, 1.75 / Math.cos((latitude * Math.PI) / 180));
    for (let longitude = -180; longitude < 180; longitude += longitudeStep) {
      const point: [number, number] = [longitude, latitude];
      if (d3.geoContains(land, point)) dots.push(point);
    }
  }
  return dots;
}

export interface WireframeDottedGlobeProps {
  className?: string;
  initialRotation?: [number, number, number];
}

export function WireframeDottedGlobe({
  className,
  initialRotation = DEFAULT_ROTATION,
}: WireframeDottedGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const containerElement = containerRef.current;
    const canvasElement = canvasRef.current;
    if (!containerElement || !canvasElement) return;
    const container = containerElement;
    const canvas = canvasElement;

    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      setLoadError(true);
      return;
    }
    const context = canvasContext;

    let disposed = false;
    let land: FeatureCollection<Geometry> | null = null;
    let dots: [number, number][] = [];
    let size = 0;
    let frame = 0;
    let lastFrame = performance.now();
    let interacting = false;
    let resumeTimer: number | undefined;
    let visible = true;
    let pageVisible = document.visibilityState === "visible";
    let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rotation: [number, number, number] = [...initialRotation];
    const projection = d3.geoOrthographic();
    const graticule = d3.geoGraticule10();
    const path = d3.geoPath(projection, context);

    let activePointer: {
      id: number;
      x: number;
      y: number;
      rotation: [number, number, number];
    } | null = null;

    function themeColor(name: string, fallback: string): string {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    function resize() {
      const rect = container.getBoundingClientRect();
      size = Math.max(280, Math.floor(Math.min(rect.width, rect.height || rect.width)));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      projection
        .translate([size / 2, size / 2])
        .scale(size * 0.425)
        .rotate(rotation)
        .clipAngle(90);
      draw();
    }

    function draw() {
      if (!size) return;
      const background = themeColor("--background", "#070a0e");
      const foreground = themeColor("--foreground", "#f4f7fb");
      const border = themeColor("--globe-line", "rgba(148,163,184,.24)");
      const dot = themeColor("--globe-dot", "rgba(226,232,240,.76)");
      const accent = themeColor("--globe-accent", "rgba(96,165,250,.36)");
      const radius = projection.scale();

      context.clearRect(0, 0, size, size);
      context.save();
      context.beginPath();
      context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      context.fillStyle = background;
      context.fill();
      context.strokeStyle = foreground;
      context.globalAlpha = 0.42;
      context.lineWidth = 0.85;
      context.stroke();
      context.globalAlpha = 1;

      context.beginPath();
      path(graticule);
      context.strokeStyle = border;
      context.lineWidth = 0.55;
      context.stroke();

      if (land) {
        context.beginPath();
        path(land);
        context.strokeStyle = border;
        context.lineWidth = 0.65;
        context.stroke();

        const [lambda, phi] = projection.rotate();
        const center: [number, number] = [-lambda, -phi];
        const dotRadius = Math.max(0.65, size / 640);
        context.fillStyle = dot;
        for (const coordinates of dots) {
          if (d3.geoDistance(coordinates, center) > Math.PI / 2) continue;
          const projected = projection(coordinates);
          if (!projected) continue;
          context.beginPath();
          context.arc(projected[0], projected[1], dotRadius, 0, Math.PI * 2);
          context.fill();
        }
      }

      context.beginPath();
      context.ellipse(size / 2, size / 2, radius * 1.31, radius * 0.36, -0.13, 0, Math.PI * 2);
      context.strokeStyle = accent;
      context.lineWidth = 0.55;
      context.stroke();
      context.restore();
    }

    function animate(now: number) {
      const elapsed = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      if (!reduceMotion && !interacting && visible && pageVisible && land) {
        rotation[0] += ROTATION_DEGREES_PER_SECOND * elapsed;
        projection.rotate(rotation);
        draw();
      }
      frame = window.requestAnimationFrame(animate);
    }

    function finishInteraction(pointerId: number) {
      if (activePointer?.id !== pointerId) return;
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      activePointer = null;
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        interacting = false;
        lastFrame = performance.now();
      }, RESUME_DELAY_MS);
    }

    function onPointerDown(event: PointerEvent) {
      if (!event.isPrimary) return;
      window.clearTimeout(resumeTimer);
      interacting = true;
      activePointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        rotation: [...rotation],
      };
      canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!activePointer || activePointer.id !== event.pointerId) return;
      const sensitivity = 0.22;
      const dx = event.clientX - activePointer.x;
      const dy = event.clientY - activePointer.y;
      rotation[0] = activePointer.rotation[0] + dx * sensitivity;
      rotation[1] = clampLatitude(activePointer.rotation[1] - dy * sensitivity);
      projection.rotate(rotation);
      draw();
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    const onVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
      lastFrame = performance.now();
    };
    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      lastFrame = performance.now();
    });
    const themeObserver = new MutationObserver(draw);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", (event) => finishInteraction(event.pointerId));
    canvas.addEventListener("pointercancel", (event) => finishInteraction(event.pointerId));
    motionQuery.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resizeObserver.observe(container);
    intersectionObserver.observe(container);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    fetch(LAND_DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Land data returned ${response.status}`);
        return response.json() as Promise<FeatureCollection<Geometry>>;
      })
      .then((data) => {
        if (disposed || data.type !== "FeatureCollection") return;
        land = data;
        dots = makeLandDots(data);
        setLoadError(false);
        draw();
      })
      .catch(() => {
        if (!disposed) setLoadError(true);
      });

    resize();
    frame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resumeTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
    };
  }, [initialRotation]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-square min-h-[280px] w-full overflow-hidden rounded-full",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        aria-label="Interactive dotted globe. Drag horizontally or vertically to rotate it."
        role="img"
        className="block max-w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
      />
      {loadError ? (
        <p
          role="status"
          className="absolute inset-x-8 bottom-10 rounded-lg border border-border bg-background/90 px-4 py-3 text-center text-sm text-muted-foreground"
        >
          The local globe geometry could not be loaded.
        </p>
      ) : null}
      <p className="sr-only">
        Automatic rotation pauses while you interact and is disabled when reduced motion is
        requested.
      </p>
    </div>
  );
}

export default WireframeDottedGlobe;
