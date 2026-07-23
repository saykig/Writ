/** Sink for CLI output, injectable so tests can capture without touching stdio. */
export interface CliIO {
  out(line: string): void;
  err(line: string): void;
}

/** The default process-backed IO sink. */
export const processIO: CliIO = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
};
