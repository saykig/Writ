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
  // Trace the frozen repo data (read at runtime by lib/repo.ts) into the
  // serverless bundle so the API routes work on Vercel as well as locally.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/**": ["../../examples/**", "../../benchmark/2025-ai-sme/**"],
    "/playground": ["../../examples/**", "../../benchmark/2025-ai-sme/**"],
    "/benchmark": ["../../benchmark/2025-ai-sme/**"],
    "/how-it-works": [
      "../../examples/**",
      "../../benchmark/2025-ai-sme/**",
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
