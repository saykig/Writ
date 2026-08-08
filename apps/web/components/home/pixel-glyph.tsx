"use client";

import type { MotionValue } from "motion/react";
import { motion, useTransform } from "motion/react";

export interface GlyphCell {
  readonly column: number;
  readonly id: string;
  readonly row: number;
}

export interface PixelGlyphDefinition {
  readonly cells: readonly GlyphCell[];
  readonly columns: number;
  readonly name: "E" | "U" | "S" | "C" | "N" | "I" | "T";
  readonly rows: number;
}

export interface PixelCellPoint {
  readonly x: number;
  readonly y: number;
}

export const PIXEL_CELL_SIZE = 5.8;
export const PIXEL_CELL_STEP = 6.5;

function defineGlyph(
  name: PixelGlyphDefinition["name"],
  columns: number,
  rows: number,
  coordinates: readonly (readonly [number, number])[],
): PixelGlyphDefinition {
  const unique = new Map<string, GlyphCell>();
  for (const [column, row] of coordinates) {
    const id = `${name}-${String(row).padStart(2, "0")}-${String(column).padStart(2, "0")}`;
    unique.set(id, { column, id, row });
  }
  return { cells: [...unique.values()], columns, name, rows };
}

const columns = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

function defineGeistPixelGlyph(
  name: PixelGlyphDefinition["name"],
  width: number,
  occupiedRows: readonly (readonly number[])[],
) {
  return defineGlyph(
    name,
    width,
    19,
    occupiedRows.flatMap((occupied, row) => occupied.map((column) => [column, row] as const)),
  );
}

// Extracted from GeistPixel-Square.woff2 on its native 38-unit microcell grid.
export const E_GLYPH = defineGeistPixelGlyph("E", 16, [
  columns(2, 13),
  columns(2, 13),
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  columns(2, 13),
  columns(2, 13),
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  [2, 3],
  columns(2, 13),
  columns(2, 13),
]);

export const U_GLYPH = defineGeistPixelGlyph("U", 18, [
  ...Array.from({ length: 15 }, () => [2, 3, 14, 15]),
  [3, 4, 13, 14],
  [3, 4, 5, 12, 13, 14],
  columns(4, 13),
  columns(6, 11),
]);

export const S_GLYPH = defineGeistPixelGlyph("S", 17, [
  columns(5, 10),
  columns(3, 12),
  [3, 4, 11, 12, 13],
  [2, 3, 12, 13],
  [2, 3, 13, 14],
  [2, 3, 13, 14],
  [2, 3],
  [2, 3, 4],
  columns(3, 8),
  columns(5, 11),
  columns(8, 13),
  [11, 12, 13],
  [13, 14],
  [2, 3, 13, 14],
  [2, 3, 13, 14],
  [2, 3, 13, 14],
  [3, 4, 12, 13],
  columns(3, 13),
  columns(5, 11),
]);

export const C_GLYPH = defineGeistPixelGlyph("C", 18, [
  columns(6, 11),
  columns(4, 14),
  [3, 4, 5, 13, 14, 15],
  [3, 4, 14, 15],
  [2, 3, 15, 16],
  [2, 3, 15, 16],
  [1, 2, 15, 16],
  [1, 2],
  [1, 2],
  [1, 2],
  [1, 2],
  [1, 2],
  [1, 2, 15, 16],
  [2, 3, 15, 16],
  [2, 3, 15, 16],
  [3, 4, 14, 15],
  [3, 4, 5, 13, 14, 15],
  columns(4, 14),
  columns(6, 11),
]);

export const N_GLYPH = defineGeistPixelGlyph("N", 17, [
  [2, 3, 4, 13, 14],
  [2, 3, 4, 5, 13, 14],
  [2, 3, 4, 5, 13, 14],
  [2, 3, 5, 6, 13, 14],
  [2, 3, 5, 6, 13, 14],
  [2, 3, 6, 7, 13, 14],
  [2, 3, 6, 7, 13, 14],
  [2, 3, 7, 8, 13, 14],
  [2, 3, 7, 8, 13, 14],
  [2, 3, 8, 9, 13, 14],
  [2, 3, 8, 9, 13, 14],
  [2, 3, 9, 10, 13, 14],
  [2, 3, 9, 10, 13, 14],
  [2, 3, 10, 11, 13, 14],
  [2, 3, 10, 11, 13, 14],
  [2, 3, 12, 13, 14],
  [2, 3, 12, 13, 14],
  [2, 3, 13, 14],
  [2, 3, 13, 14],
]);

export const I_GLYPH = defineGeistPixelGlyph(
  "I",
  6,
  Array.from({ length: 19 }, () => [2, 3]),
);

export const T_GLYPH = defineGeistPixelGlyph("T", 16, [
  columns(1, 14),
  columns(1, 14),
  ...Array.from({ length: 17 }, () => [7, 8]),
]);

export function glyphCellPoint(
  definition: PixelGlyphDefinition,
  cellId: string,
  origin: PixelCellPoint,
): PixelCellPoint {
  const cell = definition.cells.find(({ id }) => id === cellId);
  if (!cell) throw new Error(`${cellId} is not a cell in ${definition.name}`);

  return {
    x: origin.x + cell.column * PIXEL_CELL_STEP + PIXEL_CELL_SIZE / 2,
    y: origin.y + cell.row * PIXEL_CELL_STEP + PIXEL_CELL_SIZE / 2,
  };
}

function PixelCell({
  cell,
  index,
  interactiveCellIds,
  isHovered,
  isSelected,
  mappedCellIds,
  origin,
  progress,
  revealRange,
  selectionActive,
}: {
  cell: GlyphCell;
  index: number;
  interactiveCellIds: ReadonlySet<string>;
  isHovered: boolean;
  isSelected: boolean;
  mappedCellIds: ReadonlySet<string>;
  origin: PixelCellPoint;
  progress: MotionValue<number>;
  revealRange: readonly [number, number];
  selectionActive: boolean;
}) {
  const stagger = (index % 9) * 0.012;
  const start = Math.min(revealRange[1] - 0.045, revealRange[0] + stagger);
  const end = Math.min(revealRange[1], start + 0.13);
  const opacity = useTransform(progress, [start, end], [0.035, 1]);
  const scaleX = useTransform(progress, [start, end], [index % 3 === 0 ? 0.18 : 0.52, 1]);
  const scaleY = useTransform(progress, [start, end], [index % 4 === 0 ? 0.32 : 0.72, 1]);
  const isInteractive = interactiveCellIds.has(cell.id);
  const isMapped = mappedCellIds.has(cell.id);
  const state = isSelected
    ? "selected"
    : isHovered
      ? "hovered"
      : selectionActive
        ? "dim"
        : isInteractive
          ? "interactive"
          : isMapped
            ? "mapped"
            : "resolved";
  const fill =
    state === "selected"
      ? "rgb(255 255 255)"
      : state === "hovered"
        ? "rgb(255 255 255)"
        : state === "interactive"
          ? "rgb(255 255 255 / 0.96)"
          : state === "mapped"
            ? "rgb(255 255 255 / 0.78)"
            : state === "dim"
              ? "rgb(255 255 255 / 0.11)"
              : "rgb(255 255 255 / 0.28)";

  return (
    <motion.rect
      data-cell-id={cell.id}
      data-cell-state={state}
      x={origin.x + cell.column * PIXEL_CELL_STEP}
      y={origin.y + cell.row * PIXEL_CELL_STEP}
      width={PIXEL_CELL_SIZE}
      height={PIXEL_CELL_SIZE}
      rx={index % 5 === 0 ? 0.7 : 0}
      animate={{
        fill,
        filter: isSelected
          ? "drop-shadow(0 0 3px rgb(255 255 255 / 0.72))"
          : isHovered
            ? "url(#pixel-corpus-cell-halo)"
            : "none",
      }}
      style={{ opacity, scaleX, scaleY, transformBox: "fill-box", transformOrigin: "center" }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    />
  );
}

/** A glyph rendered only from stable, addressable cells in one SVG coordinate system. */
export function PixelGlyph({
  definition,
  hoveredCellId,
  interactiveCellIds,
  mappedCellIds,
  origin,
  progress,
  revealRange,
  selectionActive,
  selectedCellId,
}: {
  definition: PixelGlyphDefinition;
  hoveredCellId: string | null;
  interactiveCellIds: ReadonlySet<string>;
  mappedCellIds: ReadonlySet<string>;
  origin: PixelCellPoint;
  progress: MotionValue<number>;
  revealRange: readonly [number, number];
  selectionActive: boolean;
  selectedCellId: string | null;
}) {
  return (
    <g aria-label={definition.name} role="img">
      {definition.cells.map((cell, index) => (
        <PixelCell
          key={cell.id}
          cell={cell}
          index={index}
          interactiveCellIds={interactiveCellIds}
          isHovered={cell.id === hoveredCellId}
          isSelected={cell.id === selectedCellId}
          mappedCellIds={mappedCellIds}
          origin={origin}
          progress={progress}
          revealRange={revealRange}
          selectionActive={selectionActive}
        />
      ))}
    </g>
  );
}

/** A non-interactive silhouette that reuses the exact approved glyph-cell geometry. */
export function PixelGlyphSilhouette({
  definition,
  origin,
}: {
  definition: PixelGlyphDefinition;
  origin: PixelCellPoint;
}) {
  return (
    <g aria-hidden="true">
      {definition.cells.map((cell, index) => (
        <rect
          key={cell.id}
          x={origin.x + cell.column * PIXEL_CELL_STEP}
          y={origin.y + cell.row * PIXEL_CELL_STEP}
          width={PIXEL_CELL_SIZE}
          height={PIXEL_CELL_SIZE}
          rx={index % 5 === 0 ? 0.7 : 0}
        />
      ))}
    </g>
  );
}
