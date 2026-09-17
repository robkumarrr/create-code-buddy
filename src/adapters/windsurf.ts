import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { joinGlobs } from '../core/rule';

/**
 * Windsurf is now Devin Desktop (docs.windsurf.com redirects to
 * docs.devin.ai, verified 2026-09-17). `.windsurf/rules/` remains the
 * documented backward-compatible location; `.devin/rules/` is preferred and
 * takes precedence where both exist — worth revisiting if that fallback is
 * ever dropped.
 *
 * Activation is set by a `trigger` field: `always_on` or `glob` (paired with
 * `globs`). `model_decision` and `manual` also exist, but nothing in the Rule
 * model maps to either, so they're never emitted.
 *
 * `globs` is hand-built rather than run through `renderFrontmatter`: it uses
 * the same bare, unquoted, comma-joined form as Cursor's, and a pattern
 * starting with two asterisks is YAML alias syntax — quoting it to satisfy a
 * YAML parser would put the quotes inside the pattern. `trigger: always_on`
 * alone carries no globs key and is ordinary YAML.
 */
const windsurf: AgentAdapter = {
  id: 'windsurf',
  label: 'Windsurf / Devin',
  rulesDir: '.windsurf/rules',
  ignorePaths: ['.windsurf/rules/'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render(rule: Rule): string {
    if (rule.alwaysApply) {
      return `---\ntrigger: always_on\ndescription: ${rule.description}\n---\n${WATERMARK}\n${rule.body}`;
    }
    return `---\ntrigger: glob\ndescription: ${rule.description}\nglobs: ${joinGlobs(rule.globs)}\n---\n${WATERMARK}\n${rule.body}`;
  },
};

export default windsurf;
