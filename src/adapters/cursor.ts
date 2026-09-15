import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { legacyGlobsField } from './legacy-format';

/**
 * Ported verbatim from the old `if (agent === 'cursor')` block in sync.ts.
 *
 * Cursor's `.mdc` frontmatter is deliberately not strict YAML — see plan
 * Task 3.2 — so its eventual fixed format (a bare, unquoted comma-joined
 * globs line) still won't be YAML, just a different non-YAML string. Task
 * 3.2 changes `legacyGlobsField` here to `joinGlobs`; it does not move this
 * adapter onto `renderFrontmatter`.
 */
const cursor: AgentAdapter = {
  id: 'cursor',
  label: 'Cursor',
  rulesDir: '.cursor/rules',
  ignorePaths: ['.cursor/'],

  outputPath(rule: Rule): string {
    return rule.relPath.replace(/\.md$/, '.mdc');
  },

  render(rule: Rule): string {
    return `---\ndescription: ${rule.description}\nglobs: ${legacyGlobsField(rule.globs)}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default cursor;
