import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';

/**
 * Ported verbatim from the old `if (agent === 'cline')` block in sync.ts.
 *
 * `alwaysApply` already models exactly what the old `isAlwaysOn` string check
 * computed by hand, so no legacy-format shim is needed here — this is the one
 * adapter that already reads cleanly off the normalized `Rule`.
 *
 * The recursive-wildcard prefix added to bare filenames below is plan Task
 * 3.9's open question: the wider ecosystem passes globs through verbatim,
 * and Cline is the only adapter here that rewrites them. Left as-is; a
 * maintainer decision, not a bug to fix in a pure refactor.
 */
const cline: AgentAdapter = {
  id: 'cline',
  label: 'Cline',
  rulesDir: '.clinerules',
  ignorePaths: ['.clinerules/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render(rule: Rule): string {
    if (rule.alwaysApply) {
      return `${WATERMARK}\n${rule.body}`;
    }

    const patterns = rule.globs.map((glob) => (glob.includes('/') ? glob : `**/${glob}`));
    const pathsBlock = patterns.map((pattern) => `  - "${pattern}"`).join('\n');
    return `---\npaths:\n${pathsBlock}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default cline;
