import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { renderFrontmatter, joinGlobs } from '../core/rule';

/**
 * `applyTo` is one comma-joined scalar, written through `renderFrontmatter`
 * so it is real, parseable YAML.
 *
 * It used to be built by concatenation, which emitted
 * `applyTo: "*.ts", "*.js"` for more than one glob — two quoted scalars back
 * to back, which no YAML parser accepts. Two of the four baseline rules this
 * tool ships broke on install as a result.
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
