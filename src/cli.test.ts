import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { makeWorkspace, cleanupWorkspaces, readFile, exists } from './test/workspace';

/**
 * CLI-surface tests: the real binary, in a real directory, via a real subprocess.
 *
 * These exist because exit codes and flag handling cannot be honestly tested
 * in-process. Asserting on `process.exitCode` is a proxy; asserting on what the
 * shell actually receives is the thing users and CI depend on. Every error path
 * currently exits 0, so nothing here is detectable in CI today — and we recommend
 * wiring `sync` into a postinstall hook.
 *
 * Run through tsx against src/, so no build step is required.
 */

const CLI = path.resolve(__dirname, 'index.ts');
const TSX = path.resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(cwd: string, args: string[]): RunResult {
  try {
    const stdout = execFileSync(TSX, [CLI, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', CI: '1' },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

afterEach(() => cleanupWorkspaces());

describe('exit codes', () => {
  it('sync without a config exits non-zero', () => {
    const root = makeWorkspace();
    expect(run(root, ['sync']).status).not.toBe(0);
  });

  it('add without a config exits non-zero', () => {
    const root = makeWorkspace();
    expect(run(root, ['add', '--name', 'thing']).status).not.toBe(0);
  });

  it('a successful sync exits zero', () => {
    const root = makeWorkspace();
    run(root, ['init', '--yes', '--agents', 'cursor']);
    expect(run(root, ['sync']).status).toBe(0);
  });
});

describe('agent id validation', () => {
  it('rejects an unknown agent id instead of reporting success', () => {
    const root = makeWorkspace();
    const result = run(root, ['init', '--yes', '--agents', 'notanagent']);

    // Today this prints "configured successfully! 🚀", writes the config,
    // compiles nothing and exits 0. Our own system rule instructs agents to pass
    // --agents, so a typo is invisible to the agent that made it.
    expect(result.status).not.toBe(0);
  });

  it('names the offending id and lists the valid ones', () => {
    const root = makeWorkspace();
    const output = run(root, ['init', '--yes', '--agents', 'notanagent']);
    const combined = output.stdout + output.stderr;

    expect(combined).toContain('notanagent');
    expect(combined).toMatch(/cursor/);
  });

  it('rejects the whole run if any id in the list is invalid', () => {
    const root = makeWorkspace();
    const result = run(root, ['init', '--yes', '--agents', 'cursor,notanagent']);

    expect(result.status).not.toBe(0);
    expect(exists(root, '.cursor/rules')).toBe(false);
  });

  it('accepts every documented agent id', () => {
    const root = makeWorkspace();
    const result = run(root, [
      'init', '--yes', '--agents', 'cursor,claude,cline,copilot,gemini,windsurf',
    ]);

    expect(result.status).toBe(0);
    for (const dir of [
      '.cursor/rules', '.claude/rules', '.clinerules',
      '.github/instructions', '.agents/rules', '.windsurf/rules',
    ]) {
      expect(exists(root, dir), dir).toBe(true);
    }
  });
});

describe('--yes must not modify package.json without consent', () => {
  const PKG = JSON.stringify({ name: 'demo', version: '1.0.0' }, null, 2);

  it('does not add a postinstall script by default', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    expect(run(root, ['init', '--yes', '--agents', 'cursor']).status).toBe(0);

    // `--yes` currently forces addPostinstall whenever a package.json exists,
    // with no flag to decline. An agent following our own instructions mutates
    // the user's package.json without ever asking.
    expect(JSON.parse(readFile(root, 'package.json')).scripts?.postinstall).toBeUndefined();
  });

  it('adds a postinstall script when --postinstall is passed', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    // The status assertion matters: without it, commander aborting on an
    // unrecognised flag leaves package.json untouched and the test passes for
    // entirely the wrong reason.
    expect(run(root, ['init', '--yes', '--agents', 'cursor', '--postinstall']).status).toBe(0);

    expect(JSON.parse(readFile(root, 'package.json')).scripts?.postinstall).toContain('sync');
  });

  it('honours --no-postinstall explicitly', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    // `--no-postinstall` is not a defined option today, so commander exits with
    // "unknown option" and nothing runs at all. Asserting status 0 is what makes
    // this test fail honestly rather than pass by accident.
    expect(run(root, ['init', '--yes', '--agents', 'cursor', '--no-postinstall']).status).toBe(0);
    expect(JSON.parse(readFile(root, 'package.json')).scripts?.postinstall).toBeUndefined();
  });

  it('preserves unrelated package.json fields', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    expect(run(root, ['init', '--yes', '--agents', 'cursor']).status).toBe(0);

    const pkg = JSON.parse(readFile(root, 'package.json'));
    expect(pkg.name).toBe('demo');
    expect(pkg.version).toBe('1.0.0');
  });
});

describe('--no-gitignore', () => {
  it('leaves .gitignore alone when asked', () => {
    const root = makeWorkspace({ '.gitignore': 'node_modules/\n' });

    run(root, ['init', '--yes', '--agents', 'cursor', '--no-gitignore']);

    expect(readFile(root, '.gitignore')).not.toContain('Create Code Buddy');
  });
});
