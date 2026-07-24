import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("frontend architecture", () => {
  test("all public routes have their approved headings", () => {
    const routes: Record<string, string> = {
      "app/playground/page.tsx": "Write and test a policy methodology.",
      "app/benchmark/page.tsx": "A published compliance result, reproduced from reviewed evidence.",
      "app/gap-matrix/page.tsx": "A second methodology, with a different scoring shape.",
      "app/methodologies/page.tsx": "Methodologies, made explicit.",
      "app/receipts/page.tsx": "See how each assessment was reached.",
      "app/how-it-works/page.tsx": "From methodology to reproducible assessment.",
    };

    for (const [path, heading] of Object.entries(routes)) {
      expect(read(path)).toContain(heading);
    }
  });

  test("archive is absent from routes and navigation", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/archive"))).toBe(false);
    expect(read("components/site/nav-items.ts").toLowerCase()).not.toContain("archive");
  });

  test("about is explained on the homepage rather than exposed as a route", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/about/page.tsx"))).toBe(false);
    expect(read("app/page.tsx")).toContain("From ambiguous prose to reviewable decisions.");
    expect(read("app/page.tsx")).not.toContain("Why Writ?");
    expect(read("components/site/nav-items.ts").toLowerCase()).not.toContain("about");
  });

  test("the header has no visible search or benchmark CTA", () => {
    const nav = read("components/site/site-nav.tsx");
    expect(nav).not.toContain("Search");
    expect(nav).not.toContain("Explore the G7 example");
  });

  test("the globe loads only local geometry and never intercepts wheel events", () => {
    const globe = read("components/ui/wireframe-dotted-globe.tsx");
    expect(globe).toContain('"/data/ne_110m_land.json"');
    expect(globe).not.toMatch(/https?:\/\//);
    expect(globe).not.toContain('addEventListener("wheel"');
    expect(globe).toContain('addEventListener("pointercancel"');
    expect(globe).toContain("setPointerCapture");
    expect(globe).toContain("ResizeObserver");
    expect(globe).toContain("prefers-reduced-motion");
  });

  test("dark is the explicit default and system switching is disabled", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('defaultTheme="dark"');
    expect(layout).toContain("enableSystem={false}");
  });

  test("receipts page does not invent corpus records", () => {
    const receipts = read("app/receipts/page.tsx");
    expect(receipts).toContain("No corpus receipts are published here yet.");
  });

  test("the footer omits retired metadata and links to the Writ repository", () => {
    const footer = read("components/site/site-footer.tsx");
    const navItems = read("components/site/nav-items.ts");
    expect(footer).not.toContain("Deterministic · four-valued · content-hashed");
    expect(footer).not.toContain("reproduced 8 / 8");
    expect(footer).not.toContain("Archive");
    expect(footer).not.toContain("Documentation");
    expect(navItems).toContain("https://github.com/saykig/Writ");
  });
});
