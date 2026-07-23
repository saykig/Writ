import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");

const nextConfig: NextConfig = {
  // The @covenant/* workspace packages ship raw NodeNext TypeScript source
  // (exports point at ./src/index.ts), so Next must transpile them.
  transpilePackages: [
    "@covenant/domain",
    "@covenant/provenance",
    "@covenant/evaluator",
    "@covenant/analyzer",
    "@covenant/language",
    "@covenant/benchmark",
  ],
  // The analyzer barrel statically references z3-solver (a WASM package) even
  // though this app only uses the pure-TS bounded-enumeration path.
  serverExternalPackages: ["z3-solver"],
  typedRoutes: true,
  // Trace the frozen repo data into the serverless bundle so the API routes work
  // on Vercel as well as locally. Two kinds of runtime file reads must ship:
  //   1. lib/repo.ts reads examples/ and benchmark/2025-ai-sme/ (relative to the
  //      repo root it discovers from process.cwd()).
  //   2. The @covenant/* packages read data relative to their own module via
  //      import.meta.url — @covenant/domain loads packages/domain/schemas/*.json
  //      for AJV validation (triggered by every compile/parse/evaluate), and
  //      @covenant/benchmark reads examples/2025-ai-sme-resolved.covenant plus
  //      benchmark/2025-ai-sme/. Miss any of these and the route 500s with ENOENT.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/**": [
      "../../examples/**",
      "../../benchmark/2025-ai-sme/**",
      "../../packages/domain/schemas/**",
      "../../conformance/**",
    ],
    "/playground": [
      "../../examples/**",
      "../../benchmark/2025-ai-sme/**",
      "../../packages/domain/schemas/**",
    ],
    "/benchmark": [
      "../../benchmark/2025-ai-sme/**",
      "../../packages/domain/schemas/**",
    ],
    "/how-it-works": [
      "../../examples/**",
      "../../benchmark/2025-ai-sme/**",
      "../../packages/domain/schemas/**",
      "../../conformance/**",
    ],
  },
  // The @covenant/* packages are NodeNext TS source: relative imports carry a
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
