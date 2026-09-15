import fs from 'fs';
import path from 'path';
import { RULE_EXTENSIONS } from './constants';

export interface RuleFile {
  /** Absolute path on disk. */
  abs: string;
  /** Path relative to the directory the walk started from, e.g. 'backend/db.md'. */
  rel: string;
}

function isRuleFile(name: string): boolean {
  return RULE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Recursively collects rule files under `dir`.
 *
 * Returns both absolute and base-relative paths, because callers need the
 * relative form to compare a compiled tree against the SSOT tree. This is the
 * only implementation — three divergent copies of this walk previously lived in
 * sync.ts, clean.ts and list.ts.
 */
export function getRuleFiles(dir: string, baseDir: string = dir): RuleFile[] {
  if (!fs.existsSync(dir)) return [];

  const results: RuleFile[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...getRuleFiles(fullPath, baseDir));
    } else if (isRuleFile(item.name)) {
      results.push({ abs: fullPath, rel: path.relative(baseDir, fullPath) });
    }
  }
  return results;
}

/**
 * Removes `dir` and its now-childless parents, stopping at `root`.
 * Used after deleting generated files so empty scaffolding doesn't linger.
 */
export function pruneEmptyDirs(dir: string, root: string): void {
  if (!fs.existsSync(dir) || path.resolve(dir) === path.resolve(root)) return;
  if (fs.readdirSync(dir).length > 0) return;

  fs.rmdirSync(dir);
  pruneEmptyDirs(path.dirname(dir), root);
}

/** Writes a file, creating parent directories as needed. */
export function writeFileDeep(absPath: string, contents: string): void {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, contents);
}
