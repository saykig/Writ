import { FlickeringGrid } from "@/components/ui/flickering-grid";

/**
 * HeroBackdrop — the shared atmosphere behind every page hero: a subtle,
 * theme-neutral flickering grid (reduced-motion-safe) masked to fade downward,
 * plus one soft amber glow. Used across the routes so they read as one product.
 * The parent section must be `relative overflow-hidden`; content goes in a
 * sibling with `relative`.
 */
export function HeroBackdrop({ flickerChance = 0.06 }: { flickerChance?: number }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_25%,transparent_92%)]"
      >
        <FlickeringGrid
          className="absolute inset-0 size-full"
          squareSize={3}
          gridGap={10}
          flickerChance={flickerChance}
          maxOpacity={0.22}
          color="#9ca3af"
        />
      </div>
      <div aria-hidden className="absolute inset-0 backdrop-glow" />
    </>
  );
}
