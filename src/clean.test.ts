import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cleanAgents } from './clean';
import { syncAgents } from './sync';
import { confirm, multiselect } from '@clack/prompts';
import {
  makeWorkspace,
  cleanupWorkspaces,
  seedProject,
  ruleFile,
  readFile,
  writeFile,
  exists,
  tree,
} from './test/workspace';

/**
 * Integration tests for `clean`, against a real filesystem.
 *
 * The safety property under test — "a file without the watermark is never
 * deleted" — is the single most important guarantee this tool makes. It is the
 * reason a user can point `clean` at a folder that also holds rules they wrote
 * by hand. It must never regress, so it is asserted from several directions.
 */

vi.mock('@clack/prompts', async () => {
  const actual = await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts');
  return { ...actual, confirm: vi.fn(), multiselect: vi.fn() };
});

const RULES = {
  'testing.md': ruleFile('Testing standards', ['*.test.ts']),
  'architecture.md': ruleFile('Architecture', ['*.*']),
};

/** Builds a workspace that has already been synced, so real generated files exist. */
async function syncedWorkspace(agents: string[]): Promise<string> {
  const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
  seedProject(root, { agents, rules: RULES });
  await syncAgents(root);
  return root;
}

let exitCodeBefore: typeof process.exitCode;

beforeEach(() => {
  exitCodeBefore = process.exitCode;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = exitCodeBefore;
  vi.restoreAllMocks();
  vi.mocked(confirm).mockReset();
  vi.mocked(multiselect).mockReset();
  cleanupWorkspaces();
});

describe('smart clean', () => {
  it('deletes generated files and preserves hand-written ones', async () => {
    const root = await syncedWorkspace(['cursor']);
    writeFile(root, '.cursor/rules/my-own.mdc', '# Mine\n\nNo watermark. Do not touch.');

    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root);

    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(false);
    expect(exists(root, '.cursor/rules/architecture.mdc')).toBe(false);
    expect(exists(root, '.cursor/rules/my-own.mdc')).toBe(true);
    expect(readFile(root, '.cursor/rules/my-own.mdc')).toContain('Do not touch.');
  });

  it('leaves the SSOT folder completely untouched', async () => {
    const root = await syncedWorkspace(['cursor', 'claude']);
    const before = tree(root, '.codebuddy').map((f) => [f, readFile(root, f)] as const);

    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules', '.claude/rules']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root);

    expect(tree(root, '.codebuddy').map((f) => [f, readFile(root, f)] as const)).toEqual(before);
  });

  it('deletes nothing when the user declines the confirmation', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);
    vi.mocked(confirm).mockResolvedValue(false);

    await cleanAgents(root);

    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);
  });

  it('deletes nothing when no folder is selected', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(multiselect).mockResolvedValue([]);

    await cleanAgents(root);

    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not prompt for confirmation when there is nothing generated to delete', async () => {
    const root = makeWorkspace();
    writeFile(root, '.cursor/rules/personal.mdc', '# Only a hand-written rule here');
    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);

    await cleanAgents(root);

    expect(confirm).not.toHaveBeenCalled();
    expect(exists(root, '.cursor/rules/personal.mdc')).toBe(true);
  });

  it('prunes directories left empty by deletion', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, {
      agents: ['cursor'],
      rules: { 'backend/database.md': ruleFile('DB', ['*.sql']) },
    });
    await syncAgents(root);
    expect(exists(root, '.cursor/rules/backend/database.mdc')).toBe(true);

    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);
    vi.mocked(confirm).mockResolvedValue(true);
    await cleanAgents(root);

    expect(exists(root, '.cursor/rules/backend')).toBe(false);
  });

  it('keeps a directory that still holds a hand-written rule', async () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });
    seedProject(root, {
      agents: ['cursor'],
      rules: { 'backend/database.md': ruleFile('DB', ['*.sql']) },
    });
    await syncAgents(root);
    writeFile(root, '.cursor/rules/backend/mine.mdc', '# Hand written');

    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);
    vi.mocked(confirm).mockResolvedValue(true);
    await cleanAgents(root);

    expect(exists(root, '.cursor/rules/backend/mine.mdc')).toBe(true);
  });

  it('removes the managed .gitignore block but keeps user entries', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(multiselect).mockResolvedValue(['.cursor/rules']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root);

    const gitignore = readFile(root, '.gitignore');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).not.toContain('Create Code Buddy');
  });
});

describe('hard reset', () => {
  it('requires both confirmations before deleting anything', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(confirm).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await cleanAgents(root, true);

    expect(confirm).toHaveBeenCalledTimes(2);
    expect(exists(root, '.codebuddy/testing.md')).toBe(true);
    expect(exists(root, '.cursor/rules/testing.mdc')).toBe(true);
  });

  it('stops at the first declined confirmation', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await cleanAgents(root, true);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(exists(root, '.codebuddy/testing.md')).toBe(true);
  });

  it('deletes the SSOT and every compiled folder once confirmed', async () => {
    const root = await syncedWorkspace(['cursor', 'claude', 'cline']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root, true);

    expect(exists(root, '.codebuddy')).toBe(false);
    expect(exists(root, '.cursor/rules')).toBe(false);
    expect(exists(root, '.claude/rules')).toBe(false);
    expect(exists(root, '.clinerules')).toBe(false);
  });

  it('writes a restorable tar.gz backup before deleting the SSOT', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root, true);

    const backups = fs.readdirSync(root).filter((f) => f.includes('codebuddy-backup'));
    expect(backups).toHaveLength(1);

    const { execSync } = require('child_process');
    const listing = execSync(`tar -tzf "${path.join(root, backups[0])}"`).toString();
    expect(listing).toContain('.codebuddy/testing.md');
  });

  it('removes the postinstall script it installed', async () => {
    const root = await syncedWorkspace(['cursor']);
    writeFile(
      root,
      'package.json',
      JSON.stringify(
        { name: 'demo', scripts: { postinstall: 'npx create-code-buddy sync', test: 'vitest' } },
        null,
        2,
      ),
    );
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root, true);

    const pkg = JSON.parse(readFile(root, 'package.json'));
    expect(pkg.scripts.postinstall).toBeUndefined();
    expect(pkg.scripts.test).toBe('vitest');
  });

  it('leaves an ignore entry that actually matches the backup filename', async () => {
    const root = await syncedWorkspace(['cursor']);
    vi.mocked(confirm).mockResolvedValue(true);

    await cleanAgents(root, true);

    const backup = fs.readdirSync(root).find((f) => f.includes('codebuddy-backup'));
    const gitignore = readFile(root, '.gitignore');

    // Promoted from it.fails (Task 3.8). Two bugs used to compound here: the
    // backup entry was written, then stripped again a few lines later when
    // the managed block was rebuilt with `remove: true`; and even if it had
    // survived, the pattern `*.codebuddy-backup.tar.gz` could never match
    // `.codebuddy-backup-<timestamp>.tar.gz`. Net effect: a tarball of the
    // user's entire rule set was left untracked-but-unignored, ready to be
    // committed by the next `git add -A`.
    expect(backup).toBeDefined();
    expect(gitignore).toContain('.codebuddy-backup-');
  });
});
