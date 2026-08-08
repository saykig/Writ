import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_ROOT = resolve(import.meta.dir, "..");
const read = (path: string) => readFileSync(resolve(WEB_ROOT, path), "utf8");

describe("Start Here onboarding", () => {
  test("is the first primary navigation destination without replacing existing routes", () => {
    const nav = read("components/site/nav-items.ts");
    const startHere = nav.indexOf('label: "Start Here"');

    expect(startHere).toBeGreaterThan(-1);
    expect(nav).toContain('href: "/start-here"');
    for (const label of ["Query", "Build", "Lab"]) {
      expect(nav).toContain(`label: "${label}"`);
      expect(startHere).toBeLessThan(nav.indexOf(`label: "${label}"`));
    }
  });

  test("the route exists and composes the walkthrough", () => {
    expect(existsSync(resolve(WEB_ROOT, "app/start-here/page.tsx"))).toBe(true);
    const page = read("app/start-here/page.tsx");

    expect(page).toContain("export default function StartHerePage");
    expect(page).toContain("<StartHereWalkthrough />");
    expect(page).toContain("From source to answer.");
  });

  test("carries the real NIST example through all six stages", () => {
    const walkthrough = read("components/start-here/start-here-walkthrough.tsx");

    for (const stage of ["Source", "Passage", "Record", "Corpus", "Question", "Answer"]) {
      expect(walkthrough).toContain(stage);
    }
    expect(walkthrough).toContain("National Institute of Standards and Technology");
    expect(walkthrough).toContain("U.S. Department of Commerce");
    expect(walkthrough).toContain("nist_organizational_placement");
    expect(walkthrough).toContain('aria-label="Evidence trace"');
  });

  test("opens Lab directly and keeps the technical explanation secondary", () => {
    const page = read("app/start-here/page.tsx");

    expect(page).toContain('href="/lab"');
    expect(page).toContain("Explore in Writ Lab");
    expect(page).toContain('href="/how-it-works"');
  });

  test("does not depend on Stage B records or corpus files", () => {
    const page = read("app/start-here/page.tsx");
    const walkthrough = read("components/start-here/start-here-walkthrough.tsx");
    const implementation = `${page}\n${walkthrough}`;

    for (const forbidden of [
      "nist_mandate",
      "operational_capacity",
      "european_commission",
      "interoperability",
      "corpora/",
      "readFileSync",
    ]) {
      expect(implementation).not.toContain(forbidden);
    }
  });
});
