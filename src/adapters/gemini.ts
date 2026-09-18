import fs from 'fs';
import path from 'path';
import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { getRuleFiles } from '../core/fs';
import { legacyAttributeLines } from './legacy-format';

/** The one SSOT file this adapter treats specially — see extraFiles below. */
const SYSTEM_RULE_PATH = 'codebuddy-system.md';

/** Compiles rules to `.agents/rules/`, plus one native skill — see below. */
const gemini: AgentAdapter = {
  id: 'gemini',
  label: 'Gemini',
  rulesDir: '.agents/rules',
  ignorePaths: ['.agents/rules/'],
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
   * The SSOT's own system rule also compiles to a native Gemini Skill, which
   * Gemini treats as an invokable capability rather than passive context.
   *
   * Written in ADDITION to the normal `.agents/rules/` output rather than
   * replacing it. Redirecting instead would mean `outputPath()` returning a
   * `../` path to escape its own `rulesDir`, which the rulesDir-scoped
   * collector could never find again. `extraDirs` covers the collection side.
   */
  extraFiles(rules: Rule[]): { path: string; content: string }[] {
    const systemRule = rules.find((rule) => rule.relPath === SYSTEM_RULE_PATH);
    if (!systemRule) return [];

    const lines = [...legacyAttributeLines(systemRule), 'name: codebuddy-system'];
    const frontmatter = `---\n${lines.join('\n')}\n---\n`;
    const content = `${frontmatter}${WATERMARK}\n${systemRule.body}`;

    return [{ path: '.agents/skills/codebuddy-system/SKILL.md', content }];
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
