import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/playground", destination: "/lab", permanent: true }];
  },
  // The @writ/* workspace packages ship raw NodeNext TypeScript source
  // (exports point at ./src/index.ts), so Next must transpile them.
  transpilePackages: [
    "@writ/domain",
    "@writ/provenance",
    "@writ/evaluator",
    "@writ/analyzer",
    "@writ/language",
    "@writ/benchmark",
  ],
  // The analyzer barrel statically references z3-solver (a WASM package) even
  // though this app only uses the pure-TS bounded-enumeration path.
  serverExternalPackages: ["z3-solver"],
  typedRoutes: true,
  // Trace the frozen repo data into the serverless bundle so the API routes work
  // on Vercel as well as locally. Two kinds of runtime file reads must ship:
  //   1. lib/repo.ts reads internal compatibility fixtures plus the separated
  //      G7 corpus and benchmark.
  //   2. The @writ/* packages read data relative to their own module via
  //      import.meta.url — @writ/domain loads packages/domain/schemas/*.json
  //      for AJV validation (triggered by every compile/parse/evaluate), and
  //      @writ/benchmark reads the internal G7 compatibility methodology plus
  //      those separated data paths. Miss any of these and the route 500s with ENOENT.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/**": [
      "../../internal/verification/fixtures/compatibility/g7-ai-sme/**",
      "../../corpora/multilateral/g7/2025-ai-sme/**",
      "../../internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/**",
      "../../packages/domain/schemas/**",
      "../../internal/verification/conformance/**",
    ],
    "/lab": [
      "../../internal/verification/fixtures/compatibility/g7-ai-sme/**",
      "../../corpora/multilateral/g7/2025-ai-sme/**",
      "../../internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/**",
      "../../packages/domain/schemas/**",
    ],
    "/benchmark": [
      "../../corpora/multilateral/g7/2025-ai-sme/**",
      "../../corpora/multilateral/g20/2024-rio/**",
      "../../internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/**",
      "../../packages/domain/schemas/**",
    ],
    "/how-it-works": [
      "../../internal/verification/fixtures/compatibility/g7-ai-sme/**",
      "../../corpora/multilateral/g7/2025-ai-sme/**",
      "../../internal/verification/benchmarks/evaluator/g7-2025-ai-sme-score-reproduction/**",
      "../../packages/domain/schemas/**",
      "../../internal/verification/conformance/**",
    ],
  },
  // The @writ/* packages are NodeNext TS source: relative imports carry a
  // `.js` extension that must resolve to the `.ts` file. Webpack's extensionAlias
  // does this remap (turbopack does not), so we build/dev on webpack.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
