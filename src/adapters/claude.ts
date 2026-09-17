import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { renderPathsRule } from './paths-format';

/**
 * Plan Task 3.12, resolved: Claude Code's `.claude/rules/*.md` format uses a
 * `paths:` YAML block list, not the Cursor-style `description`/`globs` the
 * old block ported verbatim in Phase 2 for lack of a numbered task. Project-
 * level rules (what this tool writes) are confirmed working with this
 * format; a documented gap affects only user-level `~/.claude` rules, which
 * this tool never touches. Shared with Cline via paths-format.ts, whose
 * documented format turns out to be identical.
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
