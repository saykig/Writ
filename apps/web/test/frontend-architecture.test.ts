import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("frontend architecture", () => {
  test("all public routes have their approved headings", () => {
    const routes: Record<string, string> = {
      "app/playground/page.tsx": "Write and test a policy methodology.",
      "app/benchmark/page.tsx": "See Writ used for policy compliance",
      "app/gap-matrix/page.tsx": "A second methodology, with a different scoring shape.",
      "app/methodologies/page.tsx": "Every rule, open to review.",
      "app/receipts/page.tsx": "See how each result was reached.",
      "app/how-it-works/page.tsx": "From methodology to reproducible assessment.",
    };

    for (const [path, heading] of Object.entries(routes)) {
      expect(read(path)).toContain(heading);
    }
  });

  test("the Playground is presented as the Writ Lab", () => {
    const playground = read("app/playground/page.tsx");
    const home = read("app/page.tsx");
    const navItems = read("components/site/nav-items.ts");

    expect(playground).toContain('eyebrow="Writ Lab"');
    expect(playground).toContain(
      "The Writ Lab shows how Writ turns a written methodology into rules that can be checked and run.",
    );
    expect(navItems).toContain('label: "Writ Lab"');
    expect(home).toContain(">Try Writ</Link>");
    expect(home).not.toContain("Try the Playground");
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
    const dots = JSON.parse(read("public/data/ne_110m_land_dots.json")) as unknown[];
    expect(globe).toContain('"/data/ne_110m_land.json"');
    expect(globe).toContain('"/data/ne_110m_land_dots.json"');
    expect(globe).not.toMatch(/https?:\/\//);
    expect(globe).not.toContain("makeLandDots");
    expect(dots).toHaveLength(3875);
    expect(globe).not.toContain('addEventListener("wheel"');
    expect(globe).not.toContain("context.ellipse");
    expect(globe).not.toContain("--globe-accent");
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

  test("receipts page presents an honest empty state and working next actions", () => {
    const receipts = read("app/receipts/page.tsx");
    expect(receipts).toContain("No public receipts are available yet.");
    expect(receipts).toContain("Open the G7 example");
    expect(receipts).toContain("Create a receipt in the Writ Lab");
  });

  test("methodologies uses the requested review-focused copy", () => {
    const methodologies = read("app/methodologies/page.tsx");
    expect(methodologies).toContain(
      "Compare the original methodology with the rules Writ uses and resolve any problems before producing a result.",
    );
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

  test("every landing-page section uses the reduced-motion-safe scroll reveal", () => {
    const home = read("app/page.tsx");
    const reveal = read("components/site/reveal.tsx");
    expect(home.match(/<Reveal(?:\s|>)/g)?.length).toBe(6);
    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toContain("prefers-reduced-motion: reduce");
    expect(reveal).toContain('status === "in"');
  });
});
