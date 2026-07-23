/**
 * `@covenant/conformance` public API.
 *
 * The canonical runner for the implementation-independent conformance corpus at
 * the repo root (`conformance/cases/**`). Load the corpus with `loadCases`, run a
 * single case with `runCase`, or the whole corpus with `runAll`. `produce` exposes
 * the raw per-kind dispatch so an alternate evaluator can be cross-checked against
 * the canonical `@covenant/*` engines over the same data.
 */

export {
  AREAS,
  casesDir,
  deepEqual,
  loadCases,
  produce,
  runAll,
  runCase,
  type Area,
  type ConformanceCase,
  type RunResult,
} from "./runner.js";
