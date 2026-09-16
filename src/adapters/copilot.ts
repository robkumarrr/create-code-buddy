import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { renderFrontmatter, joinGlobs } from '../core/rule';

/**
 * Plan Task 3.1 (highest severity). The old block emitted
 * `applyTo: "*.ts", "*.js"` for more than one glob — not valid YAML, since a
 * frontmatter value can't be two quoted scalars back to back. Two of the four
 * baseline rules this tool ships (conventions, testing) broke on install as
 * a result.
 *
 * Now goes through `renderFrontmatter`, which writes real, parseable YAML:
 * one single-quoted, comma-joined scalar. Also adds `description`, per the
 * plan's verified format reference (section 1) — the old block never emitted
 * one for Copilot at all.
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
    const applyTo = rule.globs.length > 0 ? joinGlobs(rule.globs) : '*.*';
    const frontmatter = renderFrontmatter({ description: rule.description, applyTo });
    return `${frontmatter}${WATERMARK}\n${rule.body}`;
  },
};

export default copilot;
