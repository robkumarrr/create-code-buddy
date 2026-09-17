import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { joinGlobs } from '../core/rule';

/**
 * Plan Task 3.10, resolved. The comparable-tooling signal that prompted this
 * task ("dropped Windsurf support entirely") turned out to be a rebrand, not
 * an abandonment: Windsurf is now Devin Desktop (docs.windsurf.com 307s to
 * docs.devin.ai as of 2026-09-17). `.windsurf/rules/` still works — it's the
 * documented backward-compatible fallback, with `.devin/rules/` as the new
 * preferred location. This adapter keeps writing the legacy-but-supported
 * path; whether to also target `.devin/rules/`, or rename the adapter
 * outright, is a further, separate decision — this fix is scoped to making
 * the id and directory we already ship actually work.
 *
 * The old passthrough format (bare description/globs, no activation key at
 * all) is not what the tool reads. The real schema is a `trigger` field:
 *   - always_on  -- full content on every message
 *   - glob       -- applied when a matching file is read or edited, paired
 *                   with a `globs` field
 *   - model_decision / manual exist too, but nothing in the Rule model maps
 *     to either, so this adapter never emits them
 *
 * `globs` uses the same bare, comma-joined, non-YAML form as Cursor's own
 * globs line (confirmed by example: a bare, unquoted, comma-joined list of
 * recursive-wildcard patterns) -- a pattern starting with two asterisks is
 * YAML alias syntax, so this is hand-built rather than run through
 * `renderFrontmatter`, exactly like Cursor. `trigger: always_on` on its own,
 * with no globs key, is real YAML and needs no such care.
 */
const windsurf: AgentAdapter = {
  id: 'windsurf',
  label: 'Windsurf',
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
