import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { legacyAttributeLines } from './legacy-format';

/**
 * Ported verbatim from the old `if (agent === 'gemini')` block in sync.ts.
 *
 * Also the subject of plan Task 3.11: this tool once compiled its own system
 * rule as a native Gemini Skill, which was silently dropped when Gemini
 * output moved to .agents/rules/. Restoring that is an `extraFiles()`
 * implementation on this adapter — deliberately not done here, since Phase 2
 * changes no behavior. See adapters/types.ts for why `extraFiles` exists on
 * the interface already.
 */
const gemini: AgentAdapter = {
  id: 'gemini',
  label: 'Gemini',
  rulesDir: '.agents/rules',
  ignorePaths: ['.agents/rules/'],

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

export default gemini;
