/**
 * Headless Writ language services.
 *
 * The compiler and CLI do not run a language server, so we wire only the core
 * Langium services (lexer, parser, value converter, AST reflection) over an
 * empty file system. This is enough to turn source text into a typed AST with
 * Chevrotain-based error recovery; symbol linking, type checking, and lowering
 * to IR run as dedicated passes over that AST (see `checker.ts`, `compile.ts`).
 */

import {
  createDefaultCoreModule,
  createDefaultSharedCoreModule,
  EmptyFileSystem,
  inject,
  type LangiumCoreServices,
  type LangiumSharedCoreServices,
} from "langium";
import { WritGeneratedModule, WritGeneratedSharedModule } from "./generated/module.js";

/** The bundle of shared + language-specific core services. */
export interface WritServices {
  readonly shared: LangiumSharedCoreServices;
  readonly Writ: LangiumCoreServices;
}

let cached: WritServices | undefined;

/**
 * Build (and memoize) the Writ core services. Construction is pure and
 * deterministic; a single instance is reused across parses in a process.
 */
export function createWritServices(): WritServices {
  if (cached) {
    return cached;
  }
  const shared = inject(createDefaultSharedCoreModule(EmptyFileSystem), WritGeneratedSharedModule);
  const Writ = inject(createDefaultCoreModule({ shared }), WritGeneratedModule);
  shared.ServiceRegistry.register(Writ);
  cached = { shared, Writ };
  return cached;
}
