import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncAgents } from './sync';
import {
  makeWorkspace,
  cleanupWorkspaces,
  seedProject,
  readFile,
  tree,
} from './test/workspace';

/**
 * GOLDEN OUTPUT GUARD — the objective check that a refactor changed no bytes.
 *
 * This snapshots the complete compiled output for every adapter against a fixture
 * covering the shapes that matter: multi-glob, single-glob, universal, nested,
 * no-frontmatter, and a body containing a horizontal rule.
 *
 * PHASE 2 IS A PURE REFACTOR. Its entire correctness claim is "identical bytes out,
 * different code in" — and this file is the proof. If this snapshot fails during
 * Phase 2, the refactor changed behavior, and that is a bug to investigate, not a
 * snapshot to update.
 *
 *   DO NOT RUN `vitest -u` DURING PHASE 2. NOT FOR ANY REASON.
 *
 * In PHASE 3 the snapshot is *expected* to change, because Phase 3 deliberately fixes
 * output formats. There, update it in the same commit as the fix, and the diff becomes
 * a reviewable record of exactly which bytes each fix changed — which is the cheapest
 * possible review of a format change.
 */

const FIXTURE = {
  'testing.md':
    '---\ndescription: Testing standards\nglobs: ["*.test.ts", "*.spec.ts"]\n---\n\n# Testing\n\nUse vitest.',
  'architecture.md':
    '---\ndescription: Architecture\nglobs: ["*.*"]\n---\n\n# Architecture\n\nKeep it simple.',
  'conventions.md': '---\ndescription: Conventions\nglobs: ["*.ts"]\n---\n\n# Conventions',
  'backend/database.md':
    '---\ndescription: DB rules\nglobs: ["*.sql", "*.prisma"]\n---\n\n# Database\n\nAbove.\n\n---\n\nBelow.',
  'plain.md': '# No frontmatter here\n\nJust a body.',
};

const ALL_AGENTS = ['cursor', 'claude', 'cline', 'copilot', 'gemini', 'windsurf'];

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanupWorkspaces();
});

describe('golden output', () => {
  it('compiles the fixture to exactly these bytes', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\ndist/\n' });
    seedProject(root, { agents: ALL_AGENTS, rules: FIXTURE });

    await syncAgents(root);

    const compiled = tree(root)
      .filter((f) => !f.startsWith('.codebuddy/'))
      .map((f) => `===== ${f} =====\n${readFile(root, f)}`)
      .join('\n\n');

    expect(compiled).toMatchSnapshot();
  });

  it('produces the same file set for every agent', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ALL_AGENTS, rules: FIXTURE });

    await syncAgents(root);

    expect(tree(root).filter((f) => !f.startsWith('.codebuddy/'))).toMatchSnapshot();
  });
});
