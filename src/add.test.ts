import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addEntry } from './add';
import {
  makeWorkspace,
  cleanupWorkspaces,
  seedProject,
  readFile,
  exists,
} from './test/workspace';

/**
 * Integration tests for the non-interactive path of `add` -- the one an
 * agent actually calls (codebuddy-system.md instructs agents to run
 * `npx create-code-buddy add --name ... --globs ... --description ...`), and the one with zero
 * test coverage before this file (Task 4.2). The interactive wizard below it
 * in add.ts is out of scope here, per the plan's own description of this
 * task -- it's a series of clack prompts already exercised end-to-end by
 * hand, not agent-facing the way this path is.
 */

let exitCodeBefore: typeof process.exitCode;

beforeEach(() => {
  exitCodeBefore = process.exitCode;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = exitCodeBefore;
  vi.restoreAllMocks();
  cleanupWorkspaces();
});

describe('addEntry (non-interactive)', () => {
  it('creates a rule file with the given name, globs and description', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await addEntry(root, { name: 'database', globs: '*.sql, *.prisma', description: 'DB rules' });

    const content = readFile(root, '.codebuddy/rules/database.md');
    expect(content).toContain('description: DB rules');
    expect(content).toContain('globs: ["*.sql", "*.prisma"]');
    expect(content).toContain('# database');
  });

  it('creates nested rules, making parent directories as needed', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await addEntry(root, { name: 'backend/database', description: 'DB rules' });

    expect(exists(root, '.codebuddy/rules/backend/database.md')).toBe(true);
    // The heading uses the basename, not the full nested path.
    expect(readFile(root, '.codebuddy/rules/backend/database.md')).toContain('# database');
  });

  it('does not double the .md extension when the name already has one', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await addEntry(root, { name: 'database.md' });

    expect(exists(root, '.codebuddy/rules/database.md')).toBe(true);
    expect(exists(root, '.codebuddy/database.md.md')).toBe(false);
  });

  it('quotes each glob individually, tolerating globs the caller already quoted', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await addEntry(root, { name: 'mixed', globs: '*.ts, "*.tsx", *.jsx ' });

    expect(readFile(root, '.codebuddy/rules/mixed.md')).toContain('globs: ["*.ts", "*.tsx", "*.jsx"]');
  });

  it('defaults globs to "*.*" and description to "Code Buddy Rule" when omitted', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor'] });

    await addEntry(root, { name: 'bare' });

    const content = readFile(root, '.codebuddy/rules/bare.md');
    expect(content).toContain('globs: ["*.*"]');
    expect(content).toContain('description: Code Buddy Rule');
  });

  it('triggers a sync, compiling the new rule for every configured agent', async () => {
    const root = makeWorkspace();
    seedProject(root, { agents: ['cursor', 'claude'] });

    await addEntry(root, { name: 'database', globs: '*.sql' });

    expect(exists(root, '.cursor/rules/database.mdc')).toBe(true);
    expect(exists(root, '.claude/rules/database.md')).toBe(true);
  });

  it('fails clearly, without creating anything, when .codebuddy does not exist', async () => {
    const root = makeWorkspace();

    await addEntry(root, { name: 'database' });

    expect(exists(root, '.codebuddy')).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
