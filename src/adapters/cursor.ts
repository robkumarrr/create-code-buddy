import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { joinGlobs } from '../core/rule';

/**
 * Cursor's `.mdc` frontmatter is deliberately NOT strict YAML: `globs: *.ts`
 * reads as an unresolved alias to a YAML parser. That's the documented
 * convention, so this is hand-built rather than going through
 * `renderFrontmatter` — quoting the globs to satisfy a parser would put the
 * quote characters inside the pattern as Cursor reads it.
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
