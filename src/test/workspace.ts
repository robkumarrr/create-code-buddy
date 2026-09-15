import fs from 'fs';
import os from 'os';
import path from 'path';
import YAML from 'yaml';
import { expect } from 'vitest';
import { SSOT_DIR, CONFIG_FILE, WATERMARK } from '../core/constants';

/**
 * Integration-test harness: real directories, real files, real reads.
 *
 * The previous suite mocked `fs` wholesale, which meant `existsSync` returned a
 * single global value for an entire test. That cannot express "this file exists
 * but that one doesn't" — the precondition for every stale-file, garbage
 * collection and deselection bug. Those bugs all shipped under a green suite.
 * Tests here touch a real temp directory instead.
 */

const workspaces: string[] = [];

/** Creates a real temp directory, optionally seeded with files. */
export function makeWorkspace(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-test-'));
  workspaces.push(root);
  for (const [relPath, contents] of Object.entries(files)) {
    writeFile(root, relPath, contents);
  }
  return root;
}

/** Removes every workspace created so far. Call from afterEach. */
export function cleanupWorkspaces(): void {
  while (workspaces.length > 0) {
    const root = workspaces.pop();
    if (root && fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
}

export function writeFile(root: string, relPath: string, contents: string): string {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  return abs;
}

export function readFile(root: string, relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

export function exists(root: string, relPath: string): boolean {
  return fs.existsSync(path.join(root, relPath));
}

export interface SeedOptions {
  agents: string[];
  gitignore?: boolean;
  /** Map of SSOT-relative path -> file contents, e.g. { 'testing.md': '...' }. */
  rules?: Record<string, string>;
  /** Extra files anywhere in the workspace, relative to root. */
  files?: Record<string, string>;
}

/** Writes a config.json plus rule files, the way `init` would have. */
export function seedProject(root: string, opts: SeedOptions): void {
  writeFile(
    root,
    path.join(SSOT_DIR, CONFIG_FILE),
    JSON.stringify(
      { agents: opts.agents, gitignore_compiled_agents: opts.gitignore ?? true },
      null,
      2,
    ),
  );

  for (const [relPath, contents] of Object.entries(opts.rules ?? {})) {
    writeFile(root, path.join(SSOT_DIR, relPath), contents);
  }
  for (const [relPath, contents] of Object.entries(opts.files ?? {})) {
    writeFile(root, relPath, contents);
  }
}

/** Convenience builder for a rule file with YAML-array globs. */
export function ruleFile(
  description: string,
  globs: string[],
  body = '# Body\n\nContent.',
): string {
  const globList = globs.map((g) => `"${g}"`).join(', ');
  return `---\ndescription: ${description}\nglobs: [${globList}]\n---\n\n${body}`;
}

/** Every file under `root`, as sorted root-relative paths. Hidden dirs included. */
export function tree(root: string, subPath = ''): string[] {
  const base = path.join(root, subPath);
  if (!fs.existsSync(base)) return [];

  const results: string[] = [];
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, item.name);
      if (item.isDirectory()) walk(abs);
      else results.push(path.relative(root, abs));
    }
  };
  walk(base);
  return results.sort();
}

/**
 * Splits a generated file into its frontmatter block and body.
 * Returns `null` frontmatter when the file has none.
 */
export function splitFile(contents: string): { frontmatter: string | null; body: string } {
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: contents };
  return { frontmatter: match[1], body: match[2] };
}

/**
 * Reads a generated file and asserts its frontmatter parses as real YAML,
 * returning the parsed object.
 *
 * Every adapter test must call this. It is the single assertion that catches
 * the invalid-YAML class of bug permanently — the previous suite tested the
 * Copilot adapter with one glob, the only input for which the broken
 * concatenation happened to produce parseable output.
 */
export function readFrontmatter(root: string, relPath: string): Record<string, unknown> {
  const abs = path.join(root, relPath);
  expect(fs.existsSync(abs), `expected generated file to exist: ${relPath}`).toBe(true);

  const { frontmatter } = splitFile(fs.readFileSync(abs, 'utf8'));
  expect(frontmatter, `expected frontmatter in ${relPath}`).not.toBeNull();

  let parsed: unknown;
  try {
    parsed = YAML.parse(frontmatter as string);
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    throw new Error(`Invalid YAML frontmatter in ${relPath}: ${reason}\n---\n${frontmatter}\n---`);
  }

  expect(parsed, `frontmatter in ${relPath} should be a mapping`).toBeTypeOf('object');
  return parsed as Record<string, unknown>;
}

/** Asserts a generated file carries the watermark (i.e. this tool owns it). */
export function expectWatermarked(root: string, relPath: string): void {
  expect(readFile(root, relPath)).toContain(WATERMARK);
}
