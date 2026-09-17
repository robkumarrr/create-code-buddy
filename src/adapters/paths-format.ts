import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';

/**
 * Shared by Cline and Claude Code, whose documented rules formats turn out
 * to be identical: a bare `paths:` YAML block list of double-quoted glob
 * patterns, no `description` field, and no frontmatter at all for an
 * always-apply rule.
 *
 * Verified against each tool's current documentation (2026-09-17):
 *   - Cline (docs.cline.bot/customization/cline-rules): "paths is the
 *     supported conditional... an array of glob patterns" like `"src/**"`.
 *     No prefixing convention is documented; globs are matched as written.
 *   - Claude Code: `.claude/rules/*.md` with `paths:` frontmatter, project-
 *     level rules confirmed working (a documented gap affects only
 *     user-level `~/.claude` rules, which this tool doesn't write to).
 *
 * Plan Task 3.9 (Cline's recursive-wildcard prefix) and Task 3.12 (Claude's
 * format) are the same underlying fix once verified: neither tool's own
 * documentation mentions rewriting a bare filename glob, so this passes
 * every glob through exactly as the SSOT rule states it.
 */
export function renderPathsRule(rule: Rule): string {
  if (rule.alwaysApply) {
    return `${WATERMARK}\n${rule.body}`;
  }

  const pathsBlock = rule.globs.map((glob) => `  - "${glob}"`).join('\n');
  return `---\npaths:\n${pathsBlock}\n---\n${WATERMARK}\n${rule.body}`;
}
