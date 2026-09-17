import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { renderPathsRule } from './paths-format';

/**
 * Plan Task 3.9, resolved: Cline's own documentation describes `paths` as
 * "an array of glob patterns" matched as written, with no mention of any
 * prefixing convention. The old recursive-wildcard prefix on bare filenames
 * was this adapter's own invention, not something Cline's docs or the wider
 * ecosystem does — removed in favour of passing every glob through exactly
 * as the SSOT rule states it. See paths-format.ts, shared with Claude Code,
 * whose documented format turns out to be identical.
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
