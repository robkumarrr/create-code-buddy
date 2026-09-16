import pc from 'picocolors';

/**
 * Reports a fatal, recoverable error: prints it in red and marks the process
 * as failed, without throwing or exiting immediately.
 *
 * Every error path in this codebase used to just `console.error` and
 * `return`, leaving `process.exitCode` at its default of 0 — so a CI step
 * running `npx create-code-buddy sync` (as the postinstall script this tool
 * offers to add does) could never detect a failed sync; the step would
 * always report success.
 *
 * Sets `process.exitCode` rather than calling `process.exit()` directly, so
 * pending writes and stdout/stderr flush before the process actually exits —
 * `process.exit()` can truncate output that hasn't been flushed yet.
 */
export function fail(message: string): void {
  console.error(pc.red(message));
  process.exitCode = 1;
}
