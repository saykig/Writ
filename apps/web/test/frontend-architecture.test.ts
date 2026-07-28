import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("frontend architecture", () => {
  test("all public routes have their approved headings", () => {
    const routes: Record<string, string> = {
      "app/playground/page.tsx": "Write and test a policy methodology.",
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

  test("the site is three surfaces and the nav names exactly two", () => {
    const navItems = read("components/site/nav-items.ts");

    // Writ Lab and How it works; the homepage is reached from the wordmark.
    expect(navItems).toContain('label: "Writ Lab"');
    expect(navItems).toContain('label: "How it works"');
    for (const removed of ["Benchmark", "Methodologies", "Receipts", "Gap Matrix", "Policy Test"]) {
      expect(navItems).not.toContain(`label: "${removed}"`);
    }
    // The retired groups are gone rather than left dangling.
    expect(navItems).not.toContain("SECONDARY_NAV");
    expect(navItems).not.toContain("RESEARCH_NAV");

    for (const page of ["app/page.tsx", "app/how-it-works/page.tsx", "app/playground/page.tsx"]) {
      expect(existsSync(resolve(WEB_ROOT, page))).toBe(true);
    }
    for (const gone of [
      "app/benchmark",
      "app/gap-matrix",
      "app/methodologies",
      "app/receipts",
      "app/policy-test",
    ]) {
      expect(existsSync(resolve(WEB_ROOT, gone))).toBe(false);
    }
  });

  test("archive is absent from routes and navigation", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/archive"))).toBe(false);
    expect(read("components/site/nav-items.ts").toLowerCase()).not.toContain("archive");
  });

  test("about is not exposed as a route", () => {
    // The homepage was reduced to the hero in "Simplify homepage to hero", which
    // removed the explanatory copy this test used to assert. What still holds is
    // the original intent: there is no About route and no About nav entry.
    const home = read("app/page.tsx");
    expect(existsSync(resolve(WEB_ROOT, "app/about/page.tsx"))).toBe(false);
    expect(home).not.toContain(
      "Institutional compliance methodologies are written for human analysts.",
    );
    expect(home).not.toContain("Why Writ?");
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
    expect(globe).toContain(".toFixed(4)");
    expect(globe).toContain(".toFixed(5)");
    expect(globe).toContain("overflow-visible rounded-full");
    expect(globe).not.toContain("overflow-hidden rounded-full");
  });

  test("the homepage globe exposes all G7 assessments without immediate navigation", () => {
    const home = read("app/page.tsx");
    const selector = read("components/g7/g7-globe-selector.tsx");
    const globe = read("components/ui/wireframe-dotted-globe.tsx");

    expect(home).toContain("<G7GlobeSelector");
    expect(selector).toContain("Published result");
    expect(selector).toContain("Writ result");
    expect(selector).toContain("Result status");
    expect(selector).toContain("Reviewed actions");
    expect(selector).toContain("View the rules, evidence, and result in Writ Lab.");
    expect(selector).toContain("/lab/g7-2025/");
    expect(globe).toContain("onPointerEnter");
    expect(globe).toContain("onFocus");
    expect(globe).toContain("markerPausedRef.current");
    expect(globe).toContain("size-11");
    expect(selector).toContain("MARKER_DISPLAY_OFFSETS");
    expect(selector).toContain("min-w-0 max-w-full");
    expect(selector).toContain("whitespace-normal");
    expect(selector).not.toContain("lg:absolute");
    expect(selector).not.toContain("min-[1400px]");
  });

  test("the globe is the only member selector and is keyboard operable", () => {
    const selector = read("components/g7/g7-globe-selector.tsx");
    const globe = read("components/ui/wireframe-dotted-globe.tsx");

    // The globe replaced the dropdown, so no control may duplicate it.
    expect(selector).not.toContain("<select");
    expect(selector).not.toContain("Choose a member");

    // The marker layer is a single composite tab stop over all members.
    expect(globe).toContain('role="listbox"');
    expect(globe).toContain('role="option"');
    expect(globe).toContain("aria-activedescendant");
    expect(globe).toContain("tabIndex={0}");

    // Arrow keys move the cursor, Home/End jump, Enter or Space opens.
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End", "Enter"]) {
      expect(globe).toContain(`"${key}"`);
    }

    // Reaching a member must turn the globe, otherwise the far side is a trap.
    expect(globe).toContain("rotateToRef.current?.(");
    expect(globe).toContain("function turnTo(");
    // Individual markers are never tab stops; the layer owns focus.
    expect(globe).toContain("markerElement.tabIndex = -1");
    // The cursor's marker is never hidden while aria-activedescendant names it.
    expect(globe).toContain("keyboardActive");
  });

  test("member-specific Lab routes preload the resolved fixture, evidence, and receipt", () => {
    const lab = read("app/lab/g7-2025/[member]/page.tsx");
    const playground = read("components/playground/playground.tsx");
    expect(lab).toContain("generateStaticParams");
    expect(lab).toContain('initialExample="resolved"');
    expect(lab).toContain("initialMember={assessment.id}");
    expect(lab).toContain("initialReceipt={receipt}");
    expect(lab).toContain("initialEvidence={evidence}");
    expect(lab).toContain("lockInitialMember");
    expect(lab).toContain('initialResultTab="receipt"');
    expect(lab).toContain("initialCompile={initialCompile}");
    expect(lab).toContain("initialAnalysis={initialAnalysis}");
    expect(lab).toContain("See how the G7 methodology was translated into Writ");
    expect(playground).toContain("<EvidencePanel evidence={initialEvidence}");
    expect(playground).not.toContain('<main className="flex-1">');
  });

  test("changing a receipt input cannot relabel a stale receipt", () => {
    const receipt = read("components/playground/receipt-panel.tsx");
    expect(receipt).toContain("evaluatedMember !== member");
    expect(receipt).toContain("evaluatedProfile !== profile");
    expect(receipt).toContain("MEMBER_LABELS[evaluatedMember]");
  });

  test("dark is the explicit default and system switching is disabled", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain('defaultTheme="dark"');
    expect(layout).toContain("enableSystem={false}");
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
    // The homepage is the hero alone.
    expect(home.match(/<Reveal(?:\s|>)/g)?.length).toBe(1);
    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toContain("prefers-reduced-motion: reduce");
    expect(reveal).toContain('status === "in"');
  });
});
