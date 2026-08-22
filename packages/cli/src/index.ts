import { processIO, type CliIO } from "./io.js";
import { runCheck, runCompile, runFmt } from "./language-commands.js";

export type { CliIO } from "./io.js";

const USAGE = [
  "writ — evidence-bound record toolchain",
  "",
  "Usage:",
  "  writ fmt <files...> [--write] [--check]",
  "  writ check <files...> [--json]",
  "  writ compile <file> [--out <file>] [--json]",
].join("\n");

export async function runCli(argv: readonly string[], io: CliIO = processIO): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (command === "fmt") return runFmt(rest, io);
    if (command === "check") return runCheck(rest, io);
    if (command === "compile") return runCompile(rest, io);
    if (command === "help" || command === "--help" || command === "-h" || command === undefined) {
      io.out(USAGE);
      return command === undefined ? 2 : 0;
    }
    io.err(`Unknown command: ${command}`);
    io.err(USAGE);
    return 2;
  } catch (error) {
    io.err(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
