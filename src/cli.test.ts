import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';
import { makeWorkspace, cleanupWorkspaces, readFile, exists } from './test/workspace';
import { ADAPTERS, ADAPTER_IDS } from './adapters';

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
    // The message's whole purpose is listing every valid id, so assert every
    // one -- matching a single id passed while the list could be anything.
    for (const id of ADAPTER_IDS) {
      expect(combined, `error should list "${id}"`).toContain(id);
    }
  });

  it('rejects the whole run if any id in the list is invalid', () => {
    const root = makeWorkspace();
    const result = run(root, ['init', '--yes', '--agents', 'cursor,notanagent']);

    expect(result.status).not.toBe(0);
    expect(exists(root, '.cursor/rules')).toBe(false);
  });

  it('accepts every agent id the registry defines', () => {
    const root = makeWorkspace();

    // Driven by the registry, not a hand-copied string. The previous version
    // listed the six ids as a literal, so a seventh adapter would have been
    // silently untested -- and a literal is exactly how the help text below
    // drifted away from reality in the first place.
    const result = run(root, ['init', '--yes', '--agents', ADAPTER_IDS.join(',')]);

    expect(result.status).toBe(0);
    for (const adapter of ADAPTERS) {
      expect(exists(root, adapter.rulesDir), adapter.rulesDir).toBe(true);
    }
  });

  it('scaffolds the full package name, never the retired short one', () => {
    const root = makeWorkspace();

    expect(run(root, ['init', '--yes', '--agents', 'cursor']).status).toBe(0);

    // The template used to say `npx ccb`. Without this tool installed -- the
    // normal case after `npx create-code-buddy init` -- that resolves the
    // unrelated npm package called `ccb`, so every scaffolded project told its
    // agents to run someone else's package.
    const system = readFile(root, '.codebuddy/rules/codebuddy-system.md');
    expect(system).toContain('npx create-code-buddy sync');
    expect(system).not.toMatch(/npx ccb(?![\w-])/);
  });

  it('advertises exactly the agent ids that exist', () => {
    const root = makeWorkspace();

    // Commander wraps long descriptions, so the ids can land on a continuation
    // line. Take the --agents entry plus every wrapped line under it, stopping
    // at the next option.
    const lines = run(root, ['init', '--help']).stdout.split('\n');
    const startIdx = lines.findIndex((line) => line.includes('--agents'));
    const rest = lines.slice(startIdx + 1);
    const endOffset = rest.findIndex((line) => /^\s+-/.test(line));
    const helpLine = [lines[startIdx], ...(endOffset === -1 ? rest : rest.slice(0, endOffset))].join(' ');

    // `--help` is the only place a user learns which ids exist, and nothing
    // executed it until this test. It had drifted to
    // "(cursor,gemini,copilot,generic)": three real adapters missing, and
    // `generic`, which has never existed. Someone reading it literally could
    // not discover `claude`.
    expect(startIdx).toBeGreaterThan(-1);
    for (const id of ADAPTER_IDS) {
      expect(helpLine, `help should mention "${id}"`).toContain(id);
    }
    expect(helpLine).not.toContain('generic');
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

  it('tells the user, in the terminal, that package.json was modified', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    const result = run(root, ['init', '--yes', '--agents', 'cursor', '--postinstall']);

    // Editing package.json makes a command run on every `npm install`, for
    // everyone on the team. It is the most consequential thing this tool does
    // and it used to be the only one with no output at all -- so an agent
    // could do it on a user's behalf and leave no trace in what they read.
    // Asserted against real stdout, because "the user was told" means the
    // terminal said so.
    expect(result.stdout).toContain('package.json');
    expect(result.stdout).toContain('npm install');
  });

  it('says nothing about package.json when it did not touch it', () => {
    const root = makeWorkspace({ 'package.json': PKG });

    const result = run(root, ['init', '--yes', '--agents', 'cursor']);

    expect(result.stdout).not.toContain('package.json');
  });

  it('says so when --postinstall was asked for but there is no package.json', () => {
    const root = makeWorkspace();

    const result = run(root, ['init', '--yes', '--agents', 'cursor', '--postinstall']);

    // Silently doing nothing leaves the user believing they got a hook.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('package.json');
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

describe('--version', () => {
  it('reports the version from package.json, not a hardcoded string', () => {
    const root = makeWorkspace();
    const expected = require('../package.json').version;

    const result = run(root, ['--version']);

    expect(result.status).toBe(0);
    // Regression guard: --version used to report a hardcoded '1.0.0' while
    // package.json said '1.0.0-beta.2', so the CLI claimed a version the
    // package itself didn't ship.
    expect(result.stdout.trim()).toBe(expected);
    expect(result.stdout).not.toContain('0.0.0-unknown');
  });
});

describe('clean --hard safety (Task 3.8)', () => {
  // The `run()` harness spawns with stdin: 'ignore', which is exactly what a
  // non-interactive shell (a git hook, a CI step) looks like: not a TTY.
  // clean --hard's two confirm() prompts would otherwise hang reading from
  // that closed stdin forever, rather than failing.

  it('fails clearly instead of hanging when stdin is not a TTY and --force is absent', () => {
    const root = makeWorkspace();
    run(root, ['init', '--yes', '--agents', 'cursor']);

    const result = run(root, ['clean', '--hard']);

    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/force/i);
    expect(exists(root, '.codebuddy')).toBe(true);
  });

  it('proceeds without prompting when --force is passed', () => {
    const root = makeWorkspace();
    run(root, ['init', '--yes', '--agents', 'cursor']);

    const result = run(root, ['clean', '--hard', '--force']);

    expect(result.status).toBe(0);
    expect(exists(root, '.codebuddy')).toBe(false);
  });
});
