import fs from 'fs';
import path from 'path';
import type { AgentAdapter } from './types';
import type { Rule } from '../core/rule';
import { WATERMARK } from '../core/constants';
import { getRuleFiles } from '../core/fs';
import { legacyAttributeLines } from './legacy-format';

/** The one SSOT file this adapter treats specially — see extraFiles below. */
const SYSTEM_RULE_PATH = 'codebuddy-system.md';

/**
 * Ported verbatim from the old `if (agent === 'gemini')` block in sync.ts,
 * plus the restoration in Task 3.11.
 */
const gemini: AgentAdapter = {
  id: 'gemini',
  label: 'Gemini',
  rulesDir: '.agents/rules',
  ignorePaths: ['.agents/rules/'],

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
   * Restores what commit 515aaa3 shipped once: the SSOT's own system rule
   * compiled as a native Gemini Skill, not just a passive always-on rule.
   * Silently dropped when Gemini's output moved to .agents/rules/ in
   * 1fcc7cb — nothing guarded it, so the regression was invisible until this
   * repo's own orphaned .agents/skills/codebuddy-system/SKILL.md turned up
   * in the audit that produced this hardening plan.
   *
   * Written in ADDITION to the normal .agents/rules/codebuddy-system.md
   * output above, not as a replacement for it — the original redirected the
   * output path instead of duplicating it, but doing that today would mean
   * outputPath() reaching outside its own rulesDir (.agents/rules -> a
   * sibling .agents/skills/ directory) via a `../` return value, which the
   * normal rulesDir-scoped garbage collector can never discover to clean up
   * again if the source rule is later deleted or renamed — trading one
   * orphan bug for a mechanism that can quietly produce another. Nothing
   * pins the exact-replacement behavior; this is the deliberately safer
   * shape given what's actually specified.
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
