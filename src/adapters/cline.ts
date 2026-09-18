import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { renderPathsRule } from './paths-format';

/**
 * Cline's documented format is shared with Claude Code — see paths-format.ts.
 *
 * Globs are passed through exactly as written: Cline's docs describe `paths`
 * as "an array of glob patterns" with no prefixing convention, so the
 * recursive-wildcard prefix this adapter used to add to bare filenames was
 * its own invention.
 */
const cline: AgentAdapter = {
  id: 'cline',
  label: 'Cline',
  rulesDir: '.clinerules',
  ignorePaths: ['.clinerules/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render: renderPathsRule,
};

export default cline;
