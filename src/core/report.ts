import pc from 'picocolors';

/**
 * Reports a fatal but recoverable error: prints in red and marks the process
 * failed, without throwing or exiting immediately.
 *
 * Sets `process.exitCode` rather than calling `process.exit()`, so pending
 * stdout/stderr flushes first — `process.exit()` can truncate output that
 * hasn't been written yet.
 */
export function fail(message: string): void {
  console.error(pc.red(message));
  process.exitCode = 1;
}
