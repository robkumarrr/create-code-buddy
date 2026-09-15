import type { Rule } from '../core/rule';

/**
 * Byte-for-byte reproductions of the pre-Phase-2 string-concatenation
 * formatting, kept ONLY so the Phase 2 adapter-registry refactor changes no
 * generated output. Every one of these is a known format bug — see
 * docs/V1-HARDENING-PLAN.md Phase 3 — and every call site names the task that
 * replaces it.
 *
 * Do not reach for these in new code. New formatting should go through
 * `renderFrontmatter` / `joinGlobs` in core/rule.ts, which produce real,
 * parseable YAML. As each Phase 3 task lands, its adapter stops importing
 * from here.
 */

/**
 * Cursor/Claude/Windsurf/Gemini's legacy globs field: a bracketed,
 * double-quoted, comma-space-separated list, or the literal fallback
 * `"*.*"` when there are none. This happens to be valid YAML for Claude and
 * Gemini, but NOT for Cursor's own .mdc dialect — see cursor.ts. Replaced by
 * plan Task 3.2 (Cursor) and the Gemini/Windsurf format work.
 */
export function legacyGlobsField(globs: string[]): string {
  return globs.length > 0 ? `[${globs.map((g) => `"${g}"`).join(', ')}]` : '"*.*"';
}

/**
 * Copilot's legacy applyTo field: the same bracketed form with the brackets
 * stripped — which is exactly why it currently emits invalid YAML for more
 * than one glob (`applyTo: "*.ts", "*.js"` is not a single scalar). Replaced
 * by plan Task 3.1.
 */
export function legacyApplyToField(globs: string[]): string {
  return legacyGlobsField(globs).replace(/^\[|\]$/g, '');
}

/**
 * Gemini/Windsurf's legacy attribute-line reconstruction.
 *
 * The original parser dumped every frontmatter key it found as a raw
 * `key: value` line, and emitted no frontmatter block at all for a rule that
 * had none. `Rule` only models `description` and `globs` as named fields, so
 * this reconstructs those two in the order every rule this tool has ever
 * generated actually uses them, then appends any passthrough `extra` keys.
 *
 * Known, deliberate gap: a source rule with only ONE of description/globs
 * present (and nothing else) would have omitted the missing key entirely
 * under the old parser; this reconstruction backfills it with the same
 * default Cursor and Claude use. No current test or generated rule exercises
 * that shape — the four baseline rules and everything `add` scaffolds always
 * write both keys — and this whole helper is temporary scaffolding, not a
 * dialect worth hardening: Gemini's target format is a plain passthrough of
 * the normalized frontmatter via `renderFrontmatter`, at which point this
 * function is deleted rather than fixed further.
 */
export function legacyAttributeLines(rule: Rule): string[] {
  if (!rule.hasFrontmatter) return [];

  const lines = [`description: ${rule.description}`, `globs: ${legacyGlobsField(rule.globs)}`];

  for (const [key, value] of Object.entries(rule.extra)) {
    lines.push(`${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  }

  return lines;
}
