import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("frontend architecture", () => {
  test("the working surfaces lead with the work, not with a hero", () => {
    // The Playground opens on the readings chooser and How it works on its own
    // index; neither carries a page header above the thing it is for.
    for (const path of ["app/playground/page.tsx", "app/how-it-works/page.tsx"]) {
      expect(read(path)).not.toContain("PageHeader");
    }
    // The demo is three columns with the questions always in view, and no
    // free-text box: a memo is assembled from reviewed records, not searched for.
    const workspace = read("components/demo/demo-workspace.tsx");
    expect(workspace).toContain("Policy questions");
    expect(workspace).toContain("lg:grid-cols-[14rem_minmax(0,1fr)_21rem]");
    expect(workspace).not.toContain("<input");
    expect(workspace).not.toContain("<textarea");
    // The record column is opened on demand and closable, not a permanent third.
    expect(workspace).toContain("openRecord ?");
  });

  test("the Playground is the tool, with no page header above it", () => {
    const playground = read("app/playground/page.tsx");
    const home = read("app/page.tsx");
    const navItems = read("components/site/nav-items.ts");

    // The readings chooser is the only framing; no hero competes with it.
    expect(playground).not.toContain("PageHeader");
    expect(playground).not.toContain("eyebrow=");
    expect(navItems).toContain('label: "Playground"');
    expect(home).toContain(">Try Writ</Link>");
    expect(home).not.toContain("Try the Playground");
  });

  test("the site is four surfaces and the nav names exactly three", () => {
    const navItems = read("components/site/nav-items.ts");

    // Demo, Playground, How it works; the homepage is reached from the wordmark.
    expect(navItems).toContain('label: "Demo"');
    expect(navItems).toContain('label: "Playground"');
    expect(navItems).toContain('label: "How it works"');
    for (const removed of ["Benchmark", "Methodologies", "Receipts", "Gap Matrix", "Policy Test"]) {
      expect(navItems).not.toContain(`label: "${removed}"`);
    }
    // The retired groups are gone rather than left dangling.
    expect(navItems).not.toContain("SECONDARY_NAV");
    expect(navItems).not.toContain("RESEARCH_NAV");

    for (const page of [
      "app/page.tsx",
      "app/demo/page.tsx",
      "app/how-it-works/page.tsx",
      "app/playground/page.tsx",
    ]) {
      expect(existsSync(resolve(WEB_ROOT, page))).toBe(true);
    }
    for (const gone of [
      "app/benchmark",
      "app/gap-matrix",
      "app/methodologies",
      "app/receipts",
      "app/policy-test",
      "app/lab",
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

  test("the homepage globe answers for each jurisdiction without immediate navigation", () => {
    const home = read("app/page.tsx");
    const selector = read("components/pilot/pilot-globe-selector.tsx");
    const globe = read("components/ui/wireframe-dotted-globe.tsx");

    expect(home).toContain("<PilotGlobeSelector");
    expect(selector).toContain("Receipt score");
    expect(selector).toContain("Provisions considered");
    // The gap in the record travels with the answer.
    expect(selector).toContain("Not yet traced");
    expect(selector).toContain("See how this was answered");
    expect(selector).toContain('href="/demo"');
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
    const selector = read("components/pilot/pilot-globe-selector.tsx");
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

  test("the Lab runs the pilot readings against the traced snapshots", () => {
    const toolchain = read("lib/toolchain.ts");
    const evaluate = read("app/api/evaluate/route.ts");
    const examples = read("app/api/examples/route.ts");

    // Every reading the Lab offers is a real file under the pilot.
    for (const file of [
      "model-evaluation-duty.writ",
      "any-actor-any-force.writ",
      "broad-conduct.writ",
      "incomplete-score.writ",
    ]) {
      expect(toolchain).toContain(file);
      expect(
        existsSync(resolve(WEB_ROOT, "../../pilot/eu-us-ai-evaluation/methodology", file)),
      ).toBe(true);
    }
    expect(evaluate).toContain("evaluatePilot");
    expect(examples).toContain("loadPilotExamples");
    // The G7 member Lab and its corpus adapter are gone rather than dangling.
    expect(existsSync(resolve(WEB_ROOT, "app/lab"))).toBe(false);
    expect(existsSync(resolve(WEB_ROOT, "components/g7"))).toBe(false);
    expect(existsSync(resolve(WEB_ROOT, "lib/g7-assessments.ts"))).toBe(false);
  });

  test("changing a receipt input cannot relabel a stale receipt", () => {
    const receipt = read("components/playground/receipt-panel.tsx");
    expect(receipt).toContain("evaluatedMember !== member");
    expect(receipt).toContain("evaluatedProfile !== profile");
    expect(receipt).toContain("memberLabel(evaluatedMember ?? member)");
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
