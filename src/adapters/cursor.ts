import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { joinGlobs } from '../core/rule';

/**
 * Plan Task 3.2. Two fixes:
 *
 * 1. `globs` now uses the bare, comma-joined form Cursor's own docs and the
 *    wider ecosystem emit (`globs: *.ts,*.js`), replacing the YAML-array form
 *    the old block wrote (`globs: ["*.ts", "*.js"]`) — which parsed, but
 *    wasn't the convention.
 * 2. `alwaysApply: true` is now emitted when `rule.alwaysApply` is set; the
 *    old block dropped this key entirely, since it never modelled the
 *    concept at all.
 *
 * Cursor's `.mdc` frontmatter is deliberately NOT strict YAML — `globs:
 * *.ts` is an unresolved alias to a YAML parser — so this is hand-built,
 * like the old code, rather than going through `renderFrontmatter`. Quoting
 * the globs to make it valid YAML would put literal quote characters inside
 * the glob pattern as Cursor reads it.
 */
const cursor: AgentAdapter = {
  id: 'cursor',
  label: 'Cursor',
  rulesDir: '.cursor/rules',
  ignorePaths: ['.cursor/rules/'],

  outputPath(rule: Rule): string {
    return rule.relPath.replace(/\.md$/, '.mdc');
  },

  render(rule: Rule): string {
    const globsLine = rule.globs.length > 0 ? joinGlobs(rule.globs) : '*.*';
    const alwaysApplyLine = rule.alwaysApply ? '\nalwaysApply: true' : '';
    return `---\ndescription: ${rule.description}\nglobs: ${globsLine}${alwaysApplyLine}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default cursor;
