import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { renderPathsRule } from './paths-format';

/**
 * Claude Code's `.claude/rules/*.md` uses a `paths:` block list — the same
 * shape as Cline, so both share paths-format.ts.
 *
 * Project-level rules, which is all this tool writes, are confirmed working
 * with this format; a documented gap affects only user-level `~/.claude`
 * rules.
 */
const claude: AgentAdapter = {
  id: 'claude',
  label: 'Claude Code',
  rulesDir: '.claude/rules',
  ignorePaths: ['.claude/rules/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render: renderPathsRule,
};

export default claude;
