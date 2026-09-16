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
   * '.claude/rules/', never '.claude/' (plan Task 3.4). Ignoring a whole
   * agent folder would silently stop tracking the user's own settings,
   * commands and skills that live alongside the generated rules.
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
   * No adapter implements this yet. It exists so plan Task 3.11 (restoring
   * Gemini's SKILL.md) is additive — implement this method on one adapter —
   * rather than another change to the sync loop itself. Garbage collection
   * for extraFiles is intentionally not wired up in Phase 2, since there is
   * nothing yet to collect; the adapter that first uses this must also decide
   * how its own extra-file tree gets swept for orphans.
   */
  extraFiles?(rules: Rule[]): { path: string; content: string }[];
}
