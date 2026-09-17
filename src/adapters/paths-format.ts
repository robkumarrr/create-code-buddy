import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';

/**
 * Shared by Cline and Claude Code, whose documented rule formats are
 * identical: a `paths:` block list of double-quoted globs, no `description`,
 * and no frontmatter at all for an always-apply rule.
 *
 * Globs pass through exactly as written — neither tool documents a prefixing
 * convention. Verified against docs.cline.bot and Claude Code's rules
 * documentation, 2026-09-17.
 */
export function renderPathsRule(rule: Rule): string {
  if (rule.alwaysApply) {
    return `${WATERMARK}\n${rule.body}`;
  }

  const pathsBlock = rule.globs.map((glob) => `  - "${glob}"`).join('\n');
  return `---\npaths:\n${pathsBlock}\n---\n${WATERMARK}\n${rule.body}`;
}
