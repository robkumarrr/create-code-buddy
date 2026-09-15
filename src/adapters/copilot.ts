import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { legacyApplyToField } from './legacy-format';

/**
 * Ported verbatim from the old `if (agent === 'copilot')` block in sync.ts.
 *
 * `legacyApplyToField` reproduces the exact bug this format has today: for
 * more than one glob it emits `applyTo: "*.ts", "*.js"`, which is not valid
 * YAML. Plan Task 3.1 replaces this call with `joinGlobs` + `renderFrontmatter`,
 * emitting one single-quoted, comma-joined scalar instead.
 */
const copilot: AgentAdapter = {
  id: 'copilot',
  label: 'GitHub Copilot',
  rulesDir: '.github/instructions',
  ignorePaths: ['.github/instructions/'],

  outputPath(rule: Rule): string {
    return rule.relPath.replace(/\.md$/, '.instructions.md');
  },

  render(rule: Rule): string {
    return `---\napplyTo: ${legacyApplyToField(rule.globs)}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default copilot;
