import fs from 'fs';
import path from 'path';
import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { getRuleFiles } from '../core/fs';
import { legacyAttributeLines } from './legacy-format';

/** Compiles rules to `.agents/rules/`, the location Antigravity documents. */
const gemini: AgentAdapter = {
  id: 'gemini',
  label: 'Gemini',
  rulesDir: '.agents/rules',
  ignorePaths: ['.agents/rules/'],
  /**
   * Not an output location — a cleanup tail. Earlier versions also compiled
   * the system rule into `.agents/skills/` as a native Gemini Skill, which
   * duplicated content `.agents/rules/` already carried. That stopped; this
   * stays so the copies already on disk get collected.
   *
   * It has to stay, too: `collectLegacyOrphans` below skips the `skills`
   * segment, so removing this would leave every existing SKILL.md unreachable
   * by both `sync` and `clean` — the same orphaning this adapter already had
   * to be rescued from once.
   */
  extraDirs: ['.agents/skills'],

  outputPath(rule: Rule): string {
    return rule.relPath;
  },

  render(rule: Rule): string {
    const lines = legacyAttributeLines(rule);
    return lines.length > 0
      ? `---\n${lines.join('\n')}\n---\n${WATERMARK}\n${rule.body}`
      : `${WATERMARK}\n${rule.body}`;
  },

  /**
   * Before the .agents/rules/ refactor, every Gemini rule compiled straight
   * into .agents/ itself. Existing users still have those files on disk, and
   * the normal GC pass (scoped to .agents/rules/) can no longer see them.
   * Scoped to top-level `rules` and `skills` segments specifically, so this
   * never touches either of Gemini's own current output locations while
   * walking the same parent directory they both live under.
   */
  collectLegacyOrphans(projectRoot: string): void {
    const legacyBase = path.join(projectRoot, '.agents');
    if (!fs.existsSync(legacyBase)) return;

    for (const file of getRuleFiles(legacyBase)) {
      const topLevelSegment = file.rel.split(path.sep)[0];
      if (topLevelSegment === 'rules' || topLevelSegment === 'skills') continue;

      const content = fs.readFileSync(file.abs, 'utf8');
      if (content.includes(WATERMARK)) {
        fs.unlinkSync(file.abs);
      }
    }
  },
};

export default gemini;
