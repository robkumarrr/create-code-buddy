import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { legacyAttributeLines } from './legacy-format';

/**
 * Ported verbatim from the old `if (agent === 'windsurf')` block in sync.ts.
 *
 * Structurally identical to gemini.ts — same reconstruction, same conditional
 * frontmatter omission. Plan Task 3.10 flags that Windsurf's actual current
 * format needs re-verification (comparable tooling has dropped rules support
 * for Windsurf entirely, which suggests the format moved); that is a
 * maintainer decision, not something to guess at here.
 */
const windsurf: AgentAdapter = {
  id: 'windsurf',
  label: 'Windsurf',
  rulesDir: '.windsurf/rules',
  ignorePaths: ['.windsurf/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render(rule: Rule): string {
    const lines = legacyAttributeLines(rule);
    return lines.length > 0
      ? `---\n${lines.join('\n')}\n---\n${WATERMARK}\n${rule.body}`
      : `${WATERMARK}\n${rule.body}`;
  },
};

export default windsurf;
