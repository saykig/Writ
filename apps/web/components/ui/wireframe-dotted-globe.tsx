"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection, Geometry } from "geojson";

import { cn } from "@/lib/utils";

const LAND_DATA_URL = "/data/ne_110m_land.json";
const LAND_DOTS_URL = "/data/ne_110m_land_dots.json";
const RESUME_DELAY_MS = 900;
const ROTATION_DEGREES_PER_SECOND = 1.6;
const DEFAULT_ROTATION: [number, number, number] = [-12, -18, 0];

export function clampLatitude(value: number): number {
  return Math.max(-72, Math.min(72, value));
}

export function markerLeaderStyle(offset: readonly [number, number]): {
  width: string;
  transform: string;
} {
  return {
    width: `${Math.hypot(offset[0], offset[1]).toFixed(4)}px`,
    transform: `rotate(${Math.atan2(-offset[1], -offset[0]).toFixed(5)}rad)`,
  };
}

export interface GlobeMarker {
  readonly id: string;
  readonly label: string;
  readonly coordinates: readonly [number, number];
  /** Presentation-only offset from the geographic anchor, used to separate dense clusters. */
  readonly displayOffset?: readonly [number, number];
}

export interface WireframeDottedGlobeProps {
  className?: string;
  initialRotation?: [number, number, number];
  markers?: readonly GlobeMarker[];
  selectedMarkerId?: string | null;
  onMarkerSelect?: (markerId: string) => void;
}

export function WireframeDottedGlobe({
  className,
  initialRotation = DEFAULT_ROTATION,
  markers = [],
  selectedMarkerId = null,
  onMarkerSelect,
}: WireframeDottedGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerElementsRef = useRef(new Map<string, HTMLButtonElement>());
  const markerPausedRef = useRef(false);
  // Assigned by the render effect; turns the globe to face a member's coordinates.
  const rotateToRef = useRef<((coordinates: readonly [number, number]) => void) | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [focusedMarkerId, setFocusedMarkerId] = useState<string | null>(null);
  // The keyboard cursor. The marker layer is one tab stop and points at this
  // option via aria-activedescendant, so every member is reachable by keyboard
  // even when the globe has rotated it out of sight.
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const activeMarkerIdRef = useRef<string | null>(null);
  const emphasizedMarkerId = activeMarkerId ?? focusedMarkerId ?? hoveredMarkerId ?? selectedMarkerId;

  useEffect(() => {
    activeMarkerIdRef.current = activeMarkerId;
    markerPausedRef.current =
      hoveredMarkerId !== null || focusedMarkerId !== null || activeMarkerId !== null;
  }, [activeMarkerId, focusedMarkerId, hoveredMarkerId]);

  function moveActiveMarker(step: number | "first" | "last") {
    if (!markers.length) return;
    const currentIndex = markers.findIndex((marker) => marker.id === activeMarkerId);
    let nextIndex: number;
    if (step === "first") nextIndex = 0;
    else if (step === "last") nextIndex = markers.length - 1;
    else if (currentIndex < 0) nextIndex = step > 0 ? 0 : markers.length - 1;
    else nextIndex = (currentIndex + step + markers.length) % markers.length;
    const next = markers[nextIndex];
    if (!next) return;
    setActiveMarkerId(next.id);
    rotateToRef.current?.(next.coordinates);
  }

  function onMarkerLayerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        moveActiveMarker(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        moveActiveMarker(-1);
        break;
      case "Home":
        event.preventDefault();
        moveActiveMarker("first");
        break;
      case "End":
        event.preventDefault();
        moveActiveMarker("last");
        break;
      case "Enter":
      case " ":
        if (!activeMarkerId) return;
        event.preventDefault();
        onMarkerSelect?.(activeMarkerId);
        break;
      default:
        break;
    }
  }

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

    let turn: {
      from: [number, number];
      to: [number, number];
      start: number;
      duration: number;
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
      if (!size || !land) return;
      const background = themeColor("--background", "#070a0e");
      const foreground = themeColor("--foreground", "#f4f7fb");
      const border = themeColor("--globe-line", "rgba(148,163,184,.24)");
      const dot = themeColor("--globe-dot", "rgba(226,232,240,.76)");
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

      context.restore();

      for (const marker of markers) {
        const markerElement = markerElementsRef.current.get(marker.id);
        if (!markerElement) continue;
        const markerCoordinates: [number, number] = [
          marker.coordinates[0],
          marker.coordinates[1],
        ];
        const markerIsVisible = d3.geoDistance(markerCoordinates, center) <= Math.PI / 2;
        const projected = markerIsVisible ? projection(markerCoordinates) : null;
        // The keyboard cursor's marker stays rendered while the globe turns to
        // face it, so aria-activedescendant never points at a hidden option.
        const keyboardActive = marker.id === activeMarkerIdRef.current;
        markerElement.style.visibility = projected || keyboardActive ? "visible" : "hidden";
        markerElement.style.opacity = projected ? "1" : "0";
        // The marker layer owns the single tab stop; markers are never tab stops.
        markerElement.tabIndex = -1;
        if (projected) {
          const [offsetX, offsetY] = marker.displayOffset ?? [0, 0];
          markerElement.style.left = `${projected[0] + offsetX}px`;
          markerElement.style.top = `${projected[1] + offsetY}px`;
        }
      }
    }

    // Turn the globe so a member's coordinates face the viewer. Keyboard
    // navigation uses this to bring an off-screen marker into view, which is
    // what makes every member reachable without a pointer.
    function turnTo(coordinates: readonly [number, number]) {
      const targetLambda = -coordinates[0];
      const targetPhi = clampLatitude(-coordinates[1]);
      let delta = targetLambda - rotation[0];
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      turn = {
        from: [rotation[0], rotation[1]],
        to: [rotation[0] + delta, targetPhi],
        start: performance.now(),
        duration: reduceMotion ? 0 : 420,
      };
      lastFrame = performance.now();
    }
    rotateToRef.current = turnTo;

    function animate(now: number) {
      const elapsed = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;
      if (turn && land) {
        const progress =
          turn.duration <= 0 ? 1 : Math.min(1, (now - turn.start) / turn.duration);
        // easeInOutQuad, so the turn settles rather than snapping.
        const eased =
          progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        rotation[0] = turn.from[0] + (turn.to[0] - turn.from[0]) * eased;
        rotation[1] = turn.from[1] + (turn.to[1] - turn.from[1]) * eased;
        projection.rotate(rotation);
        draw();
        if (progress >= 1) turn = null;
      } else if (
        !reduceMotion &&
        !interacting &&
        !markerPausedRef.current &&
        visible &&
        pageVisible &&
        land
      ) {
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

    Promise.all([
      fetch(LAND_DATA_URL).then((response) => {
        if (!response.ok) throw new Error(`Land data returned ${response.status}`);
        return response.json() as Promise<FeatureCollection<Geometry>>;
      }),
      fetch(LAND_DOTS_URL).then((response) => {
        if (!response.ok) throw new Error(`Land dots returned ${response.status}`);
        return response.json() as Promise<[number, number][]>;
      }),
    ])
      .then(([data, landDots]) => {
        if (disposed || data.type !== "FeatureCollection") return;
        land = data;
        dots = landDots;
        lastFrame = performance.now();
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
      rotateToRef.current = null;
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
  }, [initialRotation, markers]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-square min-h-[280px] w-full overflow-visible rounded-full",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        aria-label="Interactive dotted globe. Drag horizontally or vertically to rotate it."
        role="img"
        className="block max-w-full cursor-grab touch-pan-y select-none active:cursor-grabbing"
      />
      {markers.length ? (
        /* One tab stop for the whole set. Arrow keys move the cursor and turn the
           globe to face that member, so keyboard users reach every marker even
           when it is on the far side; Enter or Space opens it. */
        <div
          role="listbox"
          tabIndex={0}
          aria-label="G7 assessments"
          aria-activedescendant={
            activeMarkerId ? `globe-marker-${activeMarkerId}` : undefined
          }
          onKeyDown={onMarkerLayerKeyDown}
          onFocusCapture={() => {
            // Place the cursor on the first member so the listbox announces an
            // option as soon as it receives focus.
            if (!activeMarkerIdRef.current && markers[0]) {
              setActiveMarkerId(markers[0].id);
              rotateToRef.current?.(markers[0].coordinates);
            }
          }}
          onBlurCapture={() => setActiveMarkerId(null)}
          className="pointer-events-none absolute inset-0 z-10 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {markers.map((marker) => {
            const emphasized = marker.id === emphasizedMarkerId;
            const selected = marker.id === selectedMarkerId;
            return (
              <button
                key={marker.id}
                id={`globe-marker-${marker.id}`}
                ref={(element) => {
                  if (element) markerElementsRef.current.set(marker.id, element);
                  else markerElementsRef.current.delete(marker.id);
                }}
                type="button"
                tabIndex={-1}
                role="option"
                aria-label={`Preview assessment for ${marker.label}`}
                aria-selected={selected}
                onPointerEnter={() => setHoveredMarkerId(marker.id)}
                onPointerLeave={() =>
                  setHoveredMarkerId((current) => (current === marker.id ? null : current))
                }
                onFocus={() => setFocusedMarkerId(marker.id)}
                onBlur={() =>
                  setFocusedMarkerId((current) => (current === marker.id ? null : current))
                }
                onClick={() => onMarkerSelect?.(marker.id)}
                className="pointer-events-auto absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 outline-none transition-[opacity] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {marker.displayOffset &&
                (marker.displayOffset[0] !== 0 || marker.displayOffset[1] !== 0) ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-1/2 h-px origin-left bg-primary/45"
                    style={markerLeaderStyle(marker.displayOffset)}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary-foreground/70 bg-primary [box-shadow:0_0_0_3px_color-mix(in_oklab,var(--primary)_24%,transparent),0_0_14px_var(--primary)] transition-transform",
                    emphasized && "scale-150",
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background/95 px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-opacity",
                    emphasized ? "opacity-100" : "opacity-0",
                  )}
                >
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
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
