import type { Rule } from '../core/rule';

/**
 * Everything the compiler needs to know about one target agent.
 *
 * This is the seam that used to be six near-identical `if (agent === '...')`
 * blocks in sync.ts (~85% duplicated code). Adding a seventh agent is now one
 * new file implementing this interface plus one line in adapters/index.ts,
 * instead of a copy-pasted block plus a fourth or fifth place to keep in sync.
 */
export interface AgentAdapter {
  /** Stable id used in config.json and --agents. */
  id: string;

  /** Human label for prompts, e.g. 'Claude Code'. Plain text, no color codes —
   *  presentation (padding, color) is a concern of the caller, not the adapter. */
  label: string;

  /** Where compiled rules live, relative to project root, e.g. '.cursor/rules'. */
  rulesDir: string;

  /**
   * Exact paths to write into .gitignore. Scoped to generated output —
   * '.claude/rules/', never '.claude/'. Ignoring a whole agent folder would
   * silently stop tracking the user's own settings, commands and skills that
   * live alongside the generated rules.
   */
  ignorePaths: string[];

  /** Output filename for a rule, relative to rulesDir, e.g.
   *  'backend/db.md' -> 'backend/db.mdc'. */
  outputPath(rule: Rule): string;

  /** The full file contents, watermark included. */
  render(rule: Rule): string;

  /**
   * Optional non-rule files, e.g. a native skill manifest. Paths are relative
   * to project root. Should be watermarked so they are recognized as
   * generated output.
   *
   * Written additively alongside the normal per-rule output, not as a
   * replacement for it — see gemini.ts for the one adapter using this today,
   * and why. Declare `extraDirs` alongside it so the output can be collected
   * when its source rule goes away.
   */
  extraFiles?(rules: Rule[]): { path: string; content: string }[];

  /**
   * Directories outside `rulesDir` that this adapter also writes into,
   * relative to project root. Anything watermarked in here that `extraFiles`
   * no longer produces is an orphan and gets collected, and `clean` offers
   * these alongside the rule directories.
   *
   * Without this, a file written by `extraFiles` outlives the rule it came
   * from: the garbage collector only ever scans `rulesDir`, so deleting the
   * source rule stranded the output permanently, reachable by neither `sync`
   * nor `clean`.
   */
  extraDirs?: string[];

  /**
   * Optional cleanup for files this adapter wrote to a now-abandoned
   * location, before that location existed as a modelled part of this
   * interface. Runs on every sync, active or not — an orphan is an orphan
   * whether or not the agent that made it is still selected — separately
   * from the normal `rulesDir`-scoped garbage collection.
   *
   * Exists for Gemini alone today: rules used to compile straight into
   * `.agents/` before moving to `.agents/rules/`, and existing users still
   * have those orphans on disk where the normal scan can no longer see
   * them.
   */
  collectLegacyOrphans?(projectRoot: string): void;
}
