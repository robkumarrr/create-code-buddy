import type { Rule } from '../core/rule';

/**
 * Legacy string-concatenation formatting, still used by the Gemini adapter's
 * frontmatter passthrough.
 *
 * Do not reach for these in new code — they predate the Rule model and build
 * frontmatter by hand. New formatting should go through `renderFrontmatter` /
 * `joinGlobs` in core/rule.ts, which produce real, parseable YAML.
 */

/**
 * A bracketed, double-quoted, comma-separated globs list, or the literal
 * `"*.*"` when there are none.
 */
export function legacyGlobsField(globs: string[]): string {
  return globs.length > 0 ? `[${globs.map((g) => `"${g}"`).join(', ')}]` : '"*.*"';
}

/**
 * Gemini's frontmatter passthrough: every key as a raw `key: value` line, and
 * no frontmatter block at all for a rule whose source had none.
 *
 * Known gap: a source rule with only one of description/globs would have
 * omitted the missing key under the original parser; this backfills it with
 * the same default Cursor and Claude use. Nothing generates that shape today.
 * Gemini's target format is a plain `renderFrontmatter` passthrough, at which
 * point this is deleted rather than hardened further.
 */
export function legacyAttributeLines(rule: Rule): string[] {
  if (!rule.hasFrontmatter) return [];

  const lines = [`description: ${rule.description}`, `globs: ${legacyGlobsField(rule.globs)}`];

  for (const [key, value] of Object.entries(rule.extra)) {
    lines.push(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }

  return lines;
}
