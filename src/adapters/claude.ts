import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { legacyGlobsField } from './legacy-format';

/**
 * Ported verbatim from the old `if (agent === 'claude')` block in sync.ts.
 *
 * The plan's verified format reference puts Claude Code on a `paths:` block
 * list instead — that switch is not a Phase 2 task, and is left for whoever
 * picks up the Claude format alongside Cline's (they share the same target
 * shape). This file preserves exactly what ships today.
 */
const claude: AgentAdapter = {
  id: 'claude',
  label: 'Claude Code',
  rulesDir: '.claude/rules',
  ignorePaths: ['.claude/rules/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render(rule: Rule): string {
    return `---\ndescription: ${rule.description}\nglobs: ${legacyGlobsField(rule.globs)}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default claude;
