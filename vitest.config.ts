import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist'],
    coverage: {
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        // The CLI entrypoint is exercised by cli.test.ts through the real
        // built binary as a subprocess (execFileSync), which is a stronger
        // test than an in-process unit test for a CLI would be -- but v8
        // coverage instrumentation can't see across a process boundary, so
        // this file shows as 0% covered no matter how thoroughly it's
        // tested. Excluding it here keeps the gate honest rather than
        // either failing on a false negative or hiding a real one behind an
        // artificially low threshold for every other file.
        'src/index.ts',
      ],
      // Set from the actual numbers after Phase 3 (Task 4.1), with a small
      // margin below each rather than the exact figure, so incidental drift
      // doesn't trip CI while a real regression still does. Ratchet up as
      // coverage improves -- don't lower these to make a failing PR pass.
      thresholds: {
        statements: 78,
        branches: 70,
        functions: 85,
        lines: 80,
      },
    },
  },
});
